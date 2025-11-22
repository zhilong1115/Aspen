import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'

interface CryptoFeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  features: string[]
  className?: string
  delay?: number
}

export const CryptoFeatureCard = React.forwardRef<
  HTMLDivElement,
  CryptoFeatureCardProps
>(({ icon, title, description, features, className, delay = 0 }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative h-full"
    >
      <div
        className={cn(
          'glass-card relative h-full overflow-hidden p-8 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1',
          className
        )}
      >
        <div className="relative z-10 flex flex-col h-full">
          {/* Icon container */}
          <motion.div
            className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface-soft-blue)] text-[var(--brand-primary)] shadow-sm"
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            {icon}
          </motion.div>

          {/* Title */}
          <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">
            {title}
          </h3>

          {/* Description */}
          <p className="mb-6 flex-grow leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>

          {/* Features list */}
          <div className="space-y-3 mb-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: delay + index * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--surface-soft-green)]">
                    <Check className="w-3 h-3 text-[var(--google-green)]" />
                  </div>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                  {feature}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

CryptoFeatureCard.displayName = 'CryptoFeatureCard'
