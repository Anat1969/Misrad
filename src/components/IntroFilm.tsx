import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * The 30 second opening film. Plays muted with burned-in captions;
 * one square button restarts it with Avri's voice. Reduced motion: no autoplay.
 */
export default function IntroFilm() {
  const ref = useRef<HTMLVideoElement>(null)
  const reduce = useReducedMotion()
  const [sound, setSound] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v || reduce) return
    v.muted = true
    v.play().catch(() => { /* autoplay blocked: the poster and the button stay */ })
  }, [reduce])

  const withSound = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    v.currentTime = 0
    setSound(true)
    setEnded(false)
    v.play().catch(() => { /* user gesture missing */ })
  }

  return (
    <figure className="film" aria-label="סרט פתיחה, 30 שניות">
      <div className="film-screen">
        <video ref={ref} poster="/media/poster.jpg" playsInline preload="metadata" controls={sound} muted
          onEnded={() => setEnded(true)} aria-describedby="film-text">
          <source src="/media/intro.mp4" type="video/mp4" />
          <source src="/media/intro.webm" type="video/webm" />
        </video>
        {!sound && (
          <button type="button" className="film-play" onClick={withSound} data-testid="film-sound">
            <span className="mono">30 שניות</span>
            <strong>{ended ? 'צפייה חוזרת עם קול' : 'צפייה עם קול'}</strong>
          </button>
        )}
      </div>
      <figcaption id="film-text" className="sr-only">
        הקריינות: כל אדריכל מכיר את הרגע הזה. השלב הסתיים, התוכניות אצל הלקוח, והכסף? מחכה. ARCHI-TACT משרד בונה גשר על הפער.
        כל שלב מוגש ללקוח בקישור אישי. הלקוח מאשר בלחיצה, ודרישת התשלום יוצאת לבד. ובכל רגע רואים איפה כל שקל עומד: בעבודה, מחכה לאישור, או באיחור.
        פחות רדיפה אחרי תשלומים. יותר זמן לתכנן. ARCHI-TACT משרד. מהשלב, אל התשלום.
      </figcaption>
    </figure>
  )
}
