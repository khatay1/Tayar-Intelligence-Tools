import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Marketing Manager',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face',
    text: 'The AI Writer tool has transformed how I create content. What used to take hours now takes minutes. Absolutely game-changing!',
  },
  {
    name: 'Ahmed Hassan',
    role: 'University Student',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
    text: 'Study Assistant helped me ace my exams. The way it explains complex concepts is incredible. My grades improved significantly.',
  },
  {
    name: 'Maria Garcia',
    role: 'Small Business Owner',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=face',
    text: 'As a business owner, the AI automation tools saved me countless hours. My productivity has never been higher.',
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-[#07070f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Loved by Thousands of Users
          </h2>
          <p className="text-gray-400 text-base">See what our users have to say</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map(t => (
            <div key={t.name} className="bg-[#0f0f24] border border-white/5 rounded-2xl p-8 hover:border-violet-500/20 transition-colors">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="text-white text-sm font-semibold">{t.name}</div>
                  <div className="text-gray-500 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
