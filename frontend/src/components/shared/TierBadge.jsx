export default function TierBadge({ tier }) {
  return tier === 'PREMIUM'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">⭐ PREMIUM</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">FREE</span>
}
