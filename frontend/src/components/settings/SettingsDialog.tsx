import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { api } from '../../api/client'

export type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accent: string
  setAccent: (accent: string) => void
}

export function SettingsDialog({ open, onOpenChange, accent, setAccent }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = React.useState<'general' | 'storage'>('general')
  const [theme, setTheme] = React.useState<'system' | 'light' | 'dark'>(() =>
    (localStorage.getItem('theme') as 'system' | 'light' | 'dark') || 'system'
  )
  const [contentScale, setContentScale] = React.useState<number>(() => {
    const saved = localStorage.getItem('contentScale')
    const num = saved ? parseFloat(saved) : 1
    return Number.isFinite(num) ? Math.min(1.5, Math.max(0.8, num)) : 1
  })
  const [contentPreset, setContentPreset] = React.useState<'small' | 'normal' | 'large' | 'xl' | 'custom'>((): any => {
    const saved = localStorage.getItem('contentPreset') as any
    return saved || 'normal'
  })
  const [images, setImages] = React.useState<{ url: string; mediaType?: string; filename?: string }[]>([])
  const [imagesLoading, setImagesLoading] = React.useState(false)
  const [imagesError, setImagesError] = React.useState<string | null>(null)

  const applyTheme = React.useCallback((t: 'system' | 'light' | 'dark') => {
    const root = document.documentElement
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)')
    const setDark = (on: boolean) => root.classList.toggle('dark', on)

    if (t === 'system') {
      setDark(systemPrefersDark.matches)
    } else {
      setDark(t === 'dark')
    }
  }, [])

  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') applyTheme('system')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme, applyTheme])

  React.useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme, applyTheme])

  React.useEffect(() => {
    const root = document.documentElement
    if (accent && accent.length > 0) {
      root.setAttribute('data-accent', accent)
    } else {
      root.removeAttribute('data-accent')
    }
    localStorage.setItem('accent', accent)
  }, [accent])

  React.useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--content-scale', String(contentScale))
    localStorage.setItem('contentScale', String(contentScale))
    localStorage.setItem('contentPreset', contentPreset)

    type Weights = { h1: number; h2: number; h3: number; h4: number; body: number }
    const presets: Record<string, Weights> = {
      small: { h1: 600, h2: 500, h3: 500, h4: 500, body: 400 },
      normal: { h1: 700, h2: 600, h3: 500, h4: 500, body: 400 },
      large: { h1: 800, h2: 700, h3: 600, h4: 500, body: 500 },
      xl: { h1: 900, h2: 800, h3: 700, h4: 600, body: 500 },
    }
    let key: any = contentPreset
    if (key === 'custom') {
      if (contentScale < 0.95) key = 'small'
      else if (contentScale < 1.1) key = 'normal'
      else if (contentScale < 1.25) key = 'large'
      else key = 'xl'
    }
    const w = (presets as any)[key] || presets.normal
    root.style.setProperty('--fw-h1', String(w.h1))
    root.style.setProperty('--fw-h2', String(w.h2))
    root.style.setProperty('--fw-h3', String(w.h3))
    root.style.setProperty('--fw-h4', String(w.h4))
    root.style.setProperty('--fw-body', String(w.body))
  }, [contentScale, contentPreset])

  React.useEffect(() => {
    if (!open) setActiveSection('general')
  }, [open])

  React.useEffect(() => {
    if (!open || activeSection !== 'storage') return
    let aborted = false
    setImagesLoading(true)
    setImagesError(null)
    api.ai.imageList()
      .then((res) => {
        if (aborted) return
        setImages(res.images || [])
      })
      .catch((e) => {
        if (aborted) return
        setImagesError(e.message || 'Failed to load images')
      })
      .finally(() => {
        if (aborted) return
        setImagesLoading(false)
      })
    return () => { aborted = true }
  }, [open, activeSection])

  const handleDeleteImage = React.useCallback(async (url: string) => {
    const prev = images
    setImages((arr) => arr.filter((i) => i.url !== url))
    try {
      await api.ai.deleteImage(url)
    } catch (e) {
      setImages(prev)
    }
  }, [images])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your preferences.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1 border-r pr-2 space-y-1">
            <button
              className={cn('text-sm font-medium px-2 py-1 rounded-md w-full text-left', activeSection==='general' ? 'bg-muted' : '')}
              onClick={() => setActiveSection('general')}
            >
              General
            </button>
            <button
              className={cn('text-sm font-medium px-2 py-1 rounded-md w-full text-left', activeSection==='storage' ? 'bg-muted' : '')}
              onClick={() => setActiveSection('storage')}
            >
              Storage
            </button>
            <div className="text-sm font-medium px-2 py-1 opacity-60">Notifications</div>
            <div className="text-sm font-medium px-2 py-1 opacity-60">Account</div>
          </div>
          <div className="sm:col-span-2 space-y-6">
            {activeSection === 'general' && (
              <>
                <section className="space-y-2">
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground">Choose how the interface looks. Uses system preference when set to System.</div>
                  <div className="flex gap-2">
                    {(['system','light','dark'] as const).map((t) => (
                      <button
                        key={t}
                        aria-pressed={theme===t}
                        onClick={() => {
                          setTheme(t)
                          if (t !== 'system') setAccent('')
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-md border text-sm',
                          theme===t ? 'bg-muted text-foreground border-input' : ''
                        )}
                      >
                        {t[0].toUpperCase()+t.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="space-y-2">
                  <div className="text-sm font-medium">Text size</div>
                  <div className="text-xs text-muted-foreground">Adjust content typography scale. Presets or fine-tune.</div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: 'small', label: 'Small', value: 0.9 },
                      { key: 'normal', label: 'Normal', value: 1.0 },
                      { key: 'large', label: 'Large', value: 1.15 },
                      { key: 'xl', label: 'XL', value: 1.3 },
                    ] as const).map(({ key, label, value }) => (
                      <button
                        key={key}
                        aria-pressed={contentPreset===key}
                        onClick={() => {
                          setContentPreset(key)
                          setContentScale(value)
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-md border text-sm',
                          contentPreset===key ? 'bg-muted text-foreground border-input' : ''
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min={0.8}
                      max={1.5}
                      step={0.05}
                      value={contentScale}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setContentScale(v)
                        setContentPreset('custom')
                      }}
                      className="w-full"
                      aria-label="Text size"
                    />
                    <div className="text-xs tabular-nums w-12 text-right">{contentScale.toFixed(2)}x</div>
                  </div>
                </section>
              </>
            )}
            {activeSection === 'storage' && (
              <section className="space-y-2">
                <div className="text-sm font-medium">My images</div>
                <div className="text-xs text-muted-foreground">View and delete images you have uploaded.</div>
                <div className="min-h-16">
                  {imagesLoading ? (
                    <div className="text-xs opacity-70">Loading…</div>
                  ) : imagesError ? (
                    <div className="text-xs text-destructive">{imagesError}</div>
                  ) : images.length === 0 ? (
                    <div className="text-xs opacity-70">No images found.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img) => (
                        <div key={img.url} className="group relative border rounded-md overflow-hidden">
                          <img src={img.url} alt={img.filename || 'image'} className="w-full h-28 object-cover" />
                          <button
                            onClick={() => handleDeleteImage(img.url)}
                            className="absolute top-1 right-1 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background/80 backdrop-blur border opacity-0 group-hover:opacity-100 transition"
                            aria-label="Delete image"
                          >
                            <Trash2 className="size-3" /> Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
