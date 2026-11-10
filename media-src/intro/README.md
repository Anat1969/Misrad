# סרט הפתיחה (30 שניות)

קול: Microsoft Edge TTS, `he-IL-AvriNeural`, מהירות 1.2 (`rate=+20%`). התמונה: `film.html`, דף מונפש שמסונכרן לתזמון המילים, מצולם פריים אחרי פריים.

## הפקה מחדש
```
python3 -m venv .venv && .venv/bin/pip install edge-tts
.venv/bin/python tts.py narration.txt voice.mp3 words.json          # קריינות + תזמון מילים
# קיצור הפסקות ל-0.5 שניות (ההפסקה אחרי "והכסף?" נשארת 0.9), ועדכון זמני הכתוביות ב-film.html
node render.mjs "$PWD/film.html" frames 30 30                         # 900 פריימים, 1920x1080
ffmpeg -framerate 30 -i frames/f%04d.jpg -i voice2.wav \
  -filter_complex "[1:a]apad=whole_dur=30,afade=t=out:st=29.3:d=0.7,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k -t 30 ../../public/media/intro.mp4
```
`tts.py` טוען את תעודת ה-proxy של סביבת הענן; במחשב רגיל אפשר להסיר את שלוש השורות האלה.
