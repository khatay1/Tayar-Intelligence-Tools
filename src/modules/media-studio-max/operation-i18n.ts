import type { Language } from '@/lib/i18n';
import { getMediaOperation } from './catalog';
import type { MediaOperationId } from './types';

type Copy = { name: string; description: string };

const ar: Partial<Record<MediaOperationId, Copy>> = {
  'video-to-images': { name: 'فيديو إلى صور', description: 'استخراج إطارات الفيديو كصور PNG أو JPG أو WebP.' },
  'video-to-gif': { name: 'فيديو إلى GIF', description: 'تحويل جزء من الفيديو إلى صورة GIF متحركة.' },
  'gif-to-video': { name: 'GIF إلى فيديو', description: 'تحويل GIF متحرك إلى ملف فيديو عادي.' },
  'images-to-video': { name: 'صور إلى فيديو', description: 'إنشاء عرض شرائح أو فيديو متسلسل من عدة صور.' },
  'audio-image-to-video': { name: 'صوت + صورة إلى فيديو', description: 'إنشاء فيديو من صورة ثابتة ومسار صوتي.' },
  'trim-video': { name: 'قص الفيديو', description: 'الاحتفاظ بالجزء المحدد بين وقت البداية والنهاية.' },
  'split-video': { name: 'تقسيم الفيديو', description: 'تقسيم فيديو واحد إلى مقاطع متعددة حسب المدة.' },
  'merge-videos': { name: 'دمج الفيديوهات', description: 'دمج عدة فيديوهات بالترتيب في ملف واحد.' },
  'compress-video': { name: 'ضغط الفيديو', description: 'تقليل حجم الملف مع التحكم بالجودة والدقة.' },
  'convert-video': { name: 'تحويل صيغة الفيديو', description: 'التحويل بين صيغ وحاويات الفيديو الشائعة.' },
  'remove-audio': { name: 'إزالة الصوت', description: 'إنشاء نسخة صامتة من الفيديو.' },
  'extract-audio': { name: 'استخراج الصوت', description: 'حفظ صوت الفيديو كملف MP3 أو WAV أو AAC أو M4A.' },
  'add-audio': { name: 'إضافة صوت', description: 'مزج مسار صوتي إضافي مع صوت الفيديو الأصلي.' },
  'replace-audio': { name: 'استبدال الصوت', description: 'استبدال الصوت الأصلي بمسار صوتي جديد.' },
  'change-volume': { name: 'تغيير مستوى الصوت', description: 'رفع أو خفض أو كتم صوت الفيديو.' },
  'fade-audio': { name: 'تلاشي الصوت', description: 'إضافة تلاشي تدريجي في بداية الصوت ونهايته.' },
  'change-speed': { name: 'تغيير السرعة', description: 'إنشاء حركة بطيئة أو تسريع الفيديو.' },
  'reverse-video': { name: 'عكس الفيديو', description: 'تشغيل الفيديو والصوت بشكل معكوس.' },
  'rotate-video': { name: 'تدوير الفيديو', description: 'تدوير الفيديو 90 أو 180 أو 270 درجة.' },
  'flip-video': { name: 'قلب الفيديو', description: 'قلب الفيديو أفقياً أو عمودياً.' },
  'resize-video': { name: 'تغيير أبعاد الفيديو', description: 'تغيير الدقة مع المحافظة على جودة مناسبة.' },
  'crop-video': { name: 'اقتصاص الفيديو', description: 'قص منطقة محددة من إطار الفيديو.' },
  'change-aspect-ratio': { name: 'تغيير نسبة الأبعاد', description: 'تجهيز الفيديو لنسب 16:9 و9:16 و1:1 و4:5 وغيرها.' },
  'change-fps': { name: 'تغيير FPS', description: 'تغيير عدد الإطارات في الثانية للملف الناتج.' },
  'add-subtitles': { name: 'إضافة مسار ترجمة', description: 'إرفاق ملف ترجمة بدون طباعته داخل الصورة.' },
  'burn-subtitles': { name: 'طباعة الترجمة على الفيديو', description: 'دمج نص الترجمة داخل الفيديو بشكل دائم.' },
  'add-text-watermark': { name: 'علامة مائية نصية', description: 'إضافة نص فوق الفيديو مع التحكم بالموضع والشفافية.' },
  'add-image-watermark': { name: 'علامة مائية بصورة', description: 'إضافة شعار أو صورة فوق الفيديو.' },
  'create-thumbnail': { name: 'إنشاء صورة مصغرة', description: 'التقاط صورة عالية الجودة من وقت محدد.' },
  'loop-video': { name: 'تكرار الفيديو', description: 'تكرار الفيديو عدداً محدداً من المرات.' },
  'freeze-frame': { name: 'تجميد إطار', description: 'تثبيت آخر إطار أو إطار محدد لمدة معينة.' },
  'remove-metadata': { name: 'إزالة البيانات الوصفية', description: 'حذف بيانات metadata قبل تصدير الملف النهائي.' },
};

const sv: Partial<Record<MediaOperationId, Copy>> = {
  'video-to-images': { name: 'Video till bilder', description: 'Extrahera videobildrutor som PNG-, JPG- eller WebP-bilder.' },
  'video-to-gif': { name: 'Video till GIF', description: 'Gör en vald del av en video till en animerad GIF.' },
  'gif-to-video': { name: 'GIF till video', description: 'Konvertera en animerad GIF till en vanlig videofil.' },
  'images-to-video': { name: 'Bilder till video', description: 'Skapa bildspel eller videosekvenser av flera bilder.' },
  'audio-image-to-video': { name: 'Ljud + bild till video', description: 'Skapa en video från en bild och ett ljudspår.' },
  'trim-video': { name: 'Trimma video', description: 'Behåll bara delen mellan vald start- och sluttid.' },
  'split-video': { name: 'Dela video', description: 'Dela en video i flera klipp efter vald längd.' },
  'merge-videos': { name: 'Slå ihop videor', description: 'Sammanfoga flera videor i vald ordning.' },
  'compress-video': { name: 'Komprimera video', description: 'Minska filstorleken med kontroll över kvalitet och upplösning.' },
  'convert-video': { name: 'Konvertera videoformat', description: 'Konvertera mellan vanliga videoformat och behållare.' },
  'remove-audio': { name: 'Ta bort ljud', description: 'Skapa en ljudlös kopia av videon.' },
  'extract-audio': { name: 'Extrahera ljud', description: 'Spara videons ljud som MP3, WAV, AAC eller M4A.' },
  'add-audio': { name: 'Lägg till ljud', description: 'Mixa ett extra ljudspår med videons ursprungliga ljud.' },
  'replace-audio': { name: 'Byt ljud', description: 'Ersätt videons ursprungliga ljud med ett nytt spår.' },
  'change-volume': { name: 'Ändra volym', description: 'Höj, sänk eller stäng av videons ljud.' },
  'fade-audio': { name: 'Ljudtoning', description: 'Lägg till in- och uttoning för ljudet.' },
  'change-speed': { name: 'Ändra hastighet', description: 'Skapa slow motion eller snabbare video.' },
  'reverse-video': { name: 'Spela video baklänges', description: 'Vänd både video- och ljuduppspelning.' },
  'rotate-video': { name: 'Rotera video', description: 'Rotera videon 90, 180 eller 270 grader.' },
  'flip-video': { name: 'Vänd video', description: 'Vänd videon horisontellt eller vertikalt.' },
  'resize-video': { name: 'Ändra videostorlek', description: 'Ändra upplösning med bibehållen kvalitet.' },
  'crop-video': { name: 'Beskär video', description: 'Beskär ett specifikt område av videon.' },
  'change-aspect-ratio': { name: 'Ändra bildförhållande', description: 'Förbered 16:9, 9:16, 1:1, 4:5 och anpassade format.' },
  'change-fps': { name: 'Ändra FPS', description: 'Ändra bildfrekvensen i den exporterade videon.' },
  'add-subtitles': { name: 'Lägg till undertextspår', description: 'Bifoga en undertextfil utan att bränna in texten.' },
  'burn-subtitles': { name: 'Bränn in undertexter', description: 'Rendera undertexten permanent i videobilden.' },
  'add-text-watermark': { name: 'Textvattenstämpel', description: 'Lägg anpassad text ovanpå videon.' },
  'add-image-watermark': { name: 'Bildvattenstämpel', description: 'Lägg en logotyp eller bild ovanpå videon.' },
  'create-thumbnail': { name: 'Skapa miniatyrbild', description: 'Ta en högkvalitativ stillbild från vald tidpunkt.' },
  'loop-video': { name: 'Loopa video', description: 'Upprepa videon ett valt antal gånger.' },
  'freeze-frame': { name: 'Frys bildruta', description: 'Håll en videobildruta stilla under vald tid.' },
  'remove-metadata': { name: 'Ta bort metadata', description: 'Rensa metadata före slutlig export.' },
};

export function getLocalizedOperation(id: MediaOperationId, language: Language): Copy {
  const base = getMediaOperation(id);
  const fallback = { name: base?.name || id, description: base?.description || '' };
  if (language === 'ar') return ar[id] || fallback;
  if (language === 'sv') return sv[id] || fallback;
  return fallback;
}
