import { useState } from 'react';
import useStoreInfo from '../hooks/useStoreInfo';

export default function WhatsAppButton() {
  const settings = useStoreInfo();
  const [isHovered, setIsHovered] = useState(false);

  // Normalize WhatsApp number: strip non-digits, replace leading 0 with 92 for Pakistan
  const rawNumber = '03037110762';
  let cleanedNumber = rawNumber.replace(/\D/g, '');
  if (cleanedNumber.startsWith('0')) {
    cleanedNumber = '92' + cleanedNumber.slice(1);
  }
  if (!cleanedNumber) {
    cleanedNumber = '923037110762';
  }
 
  const storeName = settings?.storeName || 'ShopHub';
  const message = encodeURIComponent(`Assalam o Alaikum! I would like to contact ${storeName} regarding shopping.`);
  const whatsappUrl = `https://wa.me/${cleanedNumber}?text=${message}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* Tooltip on Hover / Desktop preview */}
      {isHovered && (
        <div className="hidden sm:flex flex-col bg-white text-gray-800 text-xs px-3.5 py-2 rounded-xl shadow-xl border border-gray-100 transition-all duration-200 animate-in fade-in slide-in-from-right-2">
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
            Online Support
          </span>
          <span className="text-gray-600 font-medium">Get in touch on WhatsApp</span>
        </div>
      )}

      {/* Floating WhatsApp Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        aria-label="Chat on WhatsApp"
        title="WhatsApp par rabta karein"
      >
        {/* Pulse ring animation */}
        <span className="absolute -inset-1 rounded-full bg-emerald-400 opacity-40 group-hover:opacity-75 animate-ping -z-10"></span>

        {/* WhatsApp Official SVG Icon */}
        <svg
          className="w-8 h-8 fill-current transition-transform duration-300 group-hover:scale-110"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.003 2.667C8.64 2.667 2.667 8.64 2.667 16.003c0 2.347.62 4.64 1.8 6.66L2.667 29.333l6.897-1.773a13.28 13.28 0 0 0 6.44 1.653h.003c7.36 0 13.326-5.973 13.326-13.337C29.333 8.64 23.36 2.667 16.003 2.667zm0 24.4a11.04 11.04 0 0 1-5.627-1.54l-.4-.24-4.12 1.08 1.1-4.013-.26-.413a11.027 11.027 0 0 1-1.693-5.94c0-6.093 4.96-11.053 11.06-11.053 2.953 0 5.72 1.147 7.8 3.233a10.97 10.97 0 0 1 3.227 7.82c0 6.1-4.96 11.066-11.087 11.066zm6.067-8.28c-.333-.167-1.973-.973-2.28-1.08-.306-.107-.527-.16-.747.167-.22.327-.853 1.08-1.047 1.3-.193.22-.387.247-.72.08-.333-.167-1.407-.52-2.68-1.653-.993-.88-1.66-1.967-1.853-2.3-.194-.333-.02-.513.146-.68.15-.147.333-.387.5-.58.167-.193.22-.333.333-.553.113-.22.056-.413-.028-.58-.083-.167-.747-1.8-1.02-2.467-.267-.647-.54-.56-.747-.57-.193-.007-.413-.01-.633-.01-.22 0-.58.083-.887.413-.306.327-1.167 1.14-1.167 2.78s1.194 3.227 1.36 3.447c.167.22 2.347 3.58 5.687 5.02.793.34 1.413.54 1.9.693.8.253 1.527.217 2.1.133.64-.096 1.973-.807 2.253-1.587.28-.78.28-1.447.196-1.587-.083-.14-.3-.22-.633-.387z" />
        </svg>
      </a>
    </div>
  );
}
