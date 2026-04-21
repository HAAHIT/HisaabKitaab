"use client";

import { Button } from "@heroui/react";
import { ElementType } from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-default-200/50 bg-background/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150 ${className}`}
    >
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-default-100 to-default-50 mb-6 shadow-inner ring-1 ring-default-200/50">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl mix-blend-multiply dark:mix-blend-lighten"></div>
        <Icon className="h-10 w-10 text-default-600 relative z-10" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm text-default-500 max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button 
          color="primary" 
          variant="shadow" 
          onPress={onAction}
          className="mt-8 font-medium px-8"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
