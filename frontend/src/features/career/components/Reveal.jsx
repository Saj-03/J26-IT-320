import { motion, useReducedMotion } from "framer-motion";

// Fades and slides content up when it scrolls into view. `index` staggers items in a list.
// With reduced motion the content simply appears.
export default function Reveal({ index = 0, as = "div", className, children, ...props }) {
  const still = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (still) return <Tag className={className} {...props}>{children}</Tag>;
  return (
    <Tag className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay: Math.min(index, 6) * 0.07 }} {...props}>
      {children}
    </Tag>
  );
}
