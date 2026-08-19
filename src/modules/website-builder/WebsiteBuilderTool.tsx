import { useState } from 'react';
import {
  Globe,
  Layout,
  Palette,
  Type,
  Eye,
  Sparkles,
} from 'lucide-react';

interface WebsiteBuilderToolProps {
  darkMode: boolean;
}

const templates = [
  {
    id: 'business',
    name: 'Business',
    description: 'Professional website for a modern business.',
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Showcase your work, projects and skills.',
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Modern landing page for agencies and services.',
  },
];

export default function WebsiteBuilderTool({
  darkMode,
}: WebsiteBuilderToolProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('business');
  const [siteName, setSiteName] = useState('My Website');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [showPreview, setShowPreview] = useState(false);

  const template = templates.find(
    item => item.id === selectedTemplate
  );

  if (showPreview) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5" />
            <span className="font-bold">{siteName}</span>
          </div>

          <button
            onClick={() => setShowPreview(false)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Back to Builder
          </button>
        </div>

        <section className="min-h-[70vh] flex items-center justify-center px-6">
          <div className="text-center max-w-3xl">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ backgroundColor: `${primaryColor}25` }}
            >
              <Sparkles className="w-4 h-4" />
              {template?.name} Website
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              {siteName}
            </h1>

            <p className="text-xl text-gray-400 mb-8">
              {template?.description}
            </p>

            <button
              className="px-8 py-4 rounded-xl text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Get Started
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        darkMode
          ? 'bg-slate-950 text-white'
          : 'bg-gray-50 text-gray-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-7 h-7 text-violet-400" />
            <h1 className="text-3xl font-bold">
              Website Builder
            </h1>
          </div>

          <p className="text-gray-400">
            Create and customize your website without Bolt.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Layout className="w-5 h-5 text-violet-400" />
                <h2 className="font-semibold">
                  Choose a template
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {templates.map(item => (
                  <button
                    key={item.id}
                    onClick={() =>
                      setSelectedTemplate(item.id)
                    }
                    className={`text-left rounded-xl border p-5 transition ${
                      selectedTemplate === item.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="w-full h-24 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/10 mb-4 flex items-center justify-center">
                      <Globe className="w-8 h-8 text-violet-400" />
                    </div>

                    <div className="font-semibold mb-1">
                      {item.name}
                    </div>

                    <div className="text-xs text-gray-400">
                      {item.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Type className="w-5 h-5 text-violet-400" />
                <h2 className="font-semibold">
                  Website details
                </h2>
              </div>

              <label className="block text-sm text-gray-400 mb-2">
                Website name
              </label>

              <input
                value={siteName}
                onChange={event =>
                  setSiteName(event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-violet-500"
                placeholder="My Website"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Palette className="w-5 h-5 text-violet-400" />
                <h2 className="font-semibold">
                  Brand color
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={event =>
                    setPrimaryColor(event.target.value)
                  }
                  className="w-14 h-14 rounded-lg cursor-pointer bg-transparent"
                />

                <span className="text-gray-400">
                  {primaryColor}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 h-fit sticky top-6">
            <div className="flex items-center gap-2 mb-6">
              <Eye className="w-5 h-5 text-violet-400" />
              <h2 className="font-semibold">
                Website Preview
              </h2>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900">
              <div className="h-3 bg-white/5" />

              <div className="p-6 min-h-[320px] flex flex-col items-center justify-center text-center">
                <div
                  className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Globe className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-bold mb-2">
                  {siteName}
                </h3>

                <p className="text-sm text-gray-400">
                  {template?.description}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPreview(true)}
              className="w-full mt-6 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition"
            >
              <Eye className="w-4 h-4" />
              Open Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}