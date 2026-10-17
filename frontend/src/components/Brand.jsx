import { ShoppingCart } from 'lucide-react'
export default function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-mark">
        <ShoppingCart size={27} strokeWidth={2.4} />
        <span className="brand-leaf" />
      </span>
      <span>
        FreshMart<span className="text-brand"> POS</span>
      </span>
    </div>
  )
}
