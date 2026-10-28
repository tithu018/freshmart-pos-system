"""Docker integration checks. Run only against a disposable *_test database.

Uses Python's standard library, real JWT/CSRF cookies and the Nginx API proxy.
No passwords, tokens or response bodies are printed.
"""
import argparse
import http.cookiejar
import json
import pathlib
import urllib.error
import urllib.request
import uuid


class Client:
    def __init__(self, base):
        self.base = base
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, method, path, body=None, expected=200, csrf=True):
        headers = {"Origin": self.base}
        if method != "GET" and csrf:
            token = self.request("GET", "/api/auth/csrf")
            headers[token["headerName"]] = token["token"]
        data = None if body is None else json.dumps(body).encode()
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            response = self.http.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            assert response.status == expected, f"{method} {path}: expected {expected}, got {response.status}"
            content = response.read()
            return json.loads(content) if content else None

    def login(self, email, password, role):
        result = self.request("POST", "/api/auth/login", {"email": email, "password": password})
        assert result["user"]["role"] == role
        assert self.request("GET", "/api/auth/me")["user"]["email"] == email
        cookie = next(c for c in self.cookies if c.name == "freshmart_access")
        assert cookie.path == "/api" and cookie.has_nonstandard_attr("HttpOnly")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--state-file", required=True)
    parser.add_argument("--verify-existing", action="store_true")
    args = parser.parse_args()
    config = dict(line.strip().split("=", 1) for line in pathlib.Path(args.env_file).read_text().splitlines()
                  if line.strip() and not line.lstrip().startswith("#"))
    if not config.get("DB_NAME", "").endswith("_test"):
        parser.error("Refusing to write fixtures: DB_NAME must end with _test in a dedicated Compose project.")
    base = "http://localhost:" + config.get("FRONTEND_PORT", "3000")
    admin, cashier = Client(base), Client(base)
    admin.login("admin@freshmart.com", config["BOOTSTRAP_ADMIN_PASSWORD"], "ADMIN")
    cashier.login("cashier@freshmart.com", config["BOOTSTRAP_CASHIER_PASSWORD"], "CASHIER")
    print("PASS: Admin/Cashier login, session restoration and HttpOnly JWT cookies")
    state_file = pathlib.Path(args.state_file)
    if args.verify_existing:
        state = json.loads(state_file.read_text())
        for sale_id in state["sales"]:
            assert cashier.request("GET", "/api/sales/" + sale_id)["sale"]["id"] == sale_id
        assert admin.request("GET", "/api/inventory/" + state["product"])["stock"] == 6
        print("PASS: Both sales and inventory persisted after container recreation")
        return

    Client(base).request("GET", "/api/auth/me", expected=401)
    admin.request("POST", "/api/categories", {}, expected=403, csrf=False)
    cashier.request("GET", "/api/employees", expected=403)
    cashier.request("POST", "/api/categories", {}, expected=403)
    print("PASS: Anonymous access, missing CSRF and Cashier admin access rejected")
    suffix = uuid.uuid4().hex[:10]
    category = admin.request("POST", "/api/categories", {
        "name": "Docker test " + suffix, "status": "ACTIVE", "icon": "box", "color": "green"
    }, expected=201)
    product = admin.request("POST", "/api/products", {
        "name": "Docker apples " + suffix, "sku": "DOCKER-" + suffix,
        "categoryId": category["id"], "price": 2.50, "status": "ACTIVE",
        "unit": "each", "icon": "box", "color": "green"
    }, expected=201)
    stock_path = "/api/inventory/" + product["id"]
    assert admin.request("POST", stock_path + "/movements", {
        "type": "STOCK_IN", "quantity": 10, "reason": "Isolated Docker smoke test"
    })["stock"] == 10
    config_response = cashier.request("GET", "/api/pos/config")
    assert float(config_response["taxRate"]) == 0, "Use CHECKOUT_TAX_RATE=0 for this smoke test"
    sales = []
    for payment in ("CASH", "CARD"):
        order = {"idempotencyKey": str(uuid.uuid4()),
                 "items": [{"productId": product["id"], "quantity": 2, "expectedUnitPrice": 2.50}],
                 "discount": 1, "expectedTaxRate": 0, "payment": payment}
        sale = cashier.request("POST", "/api/checkout", order)
        assert float(sale["total"]) == 4 and float(sale["subtotal"]) == 5
        assert float(sale["discount"]) == 1 and float(sale["tax"]) == 0
        assert cashier.request("POST", "/api/checkout", order)["id"] == sale["id"]
        sales.append(sale["id"])
    assert admin.request("GET", stock_path)["stock"] == 6
    state_file.write_text(json.dumps({"product": product["id"], "sales": sales}))
    print("PASS: Catalog creation, stock-in, Cash/Card checkout, totals and duplicate prevention")
    print("PASS: Stock reduced exactly once per sale (10 -> 6)")


if __name__ == "__main__":
    main()
