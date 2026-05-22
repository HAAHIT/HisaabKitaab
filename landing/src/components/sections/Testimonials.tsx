"use client";
import { motion } from "framer-motion";

const quotes = [
  {
    body: "Pehle bill banane mein 5 minute lagte the. Ab WhatsApp pe customer ko 30 second mein bhej deta hoon. Paisa bhi UPI se turant aa jata hai.",
    name: "Ramesh Sharma",
    role: "General store · Karol Bagh, Delhi",
    avatar: "R",
    hue: "amber",
  },
  {
    body: "My clients used to send me bills in WhatsApp screenshots. Now SoloBooks gives me one Tally XML at quarter-end. Saves me ten hours per client.",
    name: "Priya Iyer, CA",
    role: "Chartered Accountant · Coimbatore",
    avatar: "P",
    hue: "jade",
  },
  {
    body: "Udhar Khata sabse upar dikha deta hai kisne kitna lena hai. Pehle alag-alag diary mein dhundhna padta tha.",
    name: "Mohan Patel",
    role: "Cloth wholesaler · Surat",
    avatar: "M",
    hue: "rose",
  },
];

const hue: Record<string, string> = {
  amber: "from-amber-400/20 to-amber-600/5 text-amber-200 ring-amber-400/30",
  jade: "from-emerald-400/20 to-emerald-600/5 text-emerald-200 ring-emerald-400/30",
  rose: "from-rose-400/20 to-rose-600/5 text-rose-200 ring-rose-400/30",
};

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-[0.03]" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="divider-tick">Voices from the dukaan</span>
          <h2 className="font-display text-[36px] sm:text-[52px] font-medium leading-[1.02] tracking-tight mt-4">
            What our Dukandaars say.<br />
            <span className="text-white/55">And their CAs.</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className="card p-6 sm:p-7 flex flex-col gap-5 relative"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#28e0a8]/40 absolute top-5 right-5">
                <path d="M9 7H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2H3v1h3a3 3 0 0 0 3-3V7Zm12 0h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2h-2v1h3a3 3 0 0 0 3-3V7Z" fill="currentColor"/>
              </svg>
              <blockquote className="font-display text-[18px] leading-[1.45] text-white/90">
                "{q.body}"
              </blockquote>
              <figcaption className="flex items-center gap-3 mt-auto pt-2 border-t border-white/[0.06]">
                <span className={`h-10 w-10 rounded-full grid place-items-center font-semibold ring-1 bg-gradient-to-br ${hue[q.hue]}`}>
                  {q.avatar}
                </span>
                <div>
                  <p className="text-[13.5px] text-white font-medium">{q.name}</p>
                  <p className="text-[11.5px] text-white/45">{q.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
