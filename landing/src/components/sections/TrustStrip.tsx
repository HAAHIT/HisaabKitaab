"use client";
import { motion } from "framer-motion";

const cities = [
  "Karol Bagh, Delhi",
  "Surat, Gujarat",
  "Coimbatore, TN",
  "Indore, MP",
  "Patna, Bihar",
  "Pune, MH",
  "Jaipur, RJ",
  "Vizag, AP",
  "Kanpur, UP",
  "Kochi, KL",
];

export function TrustStrip() {
  return (
    <section className="relative py-10 border-y border-white/[0.06] bg-[#08090b]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
        <p className="text-[11.5px] uppercase tracking-[0.18em] text-white/45 font-mono shrink-0">
          12,400+ shopkeepers · across India
        </p>
        <div className="relative flex-1 overflow-hidden mask-fade">
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: "-50%" }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex gap-8 whitespace-nowrap"
          >
            {[...cities, ...cities].map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-[13px] text-white/55">
                <span className="h-1 w-1 rounded-full bg-[#28e0a8]/70" />
                {c}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
      <style>{`.mask-fade{ -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); }`}</style>
    </section>
  );
}
