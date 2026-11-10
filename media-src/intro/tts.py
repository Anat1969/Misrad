import asyncio, json, sys, ssl, edge_tts, edge_tts.communicate as ec
# Trust the session proxy's CA in addition to the default bundle.
ctx = ssl.create_default_context()
ctx.load_verify_locations('/root/.ccr/ca-bundle.crt')
ec._SSL_CTX = ctx
async def main():
    text = open(sys.argv[1], encoding='utf-8').read().replace('\n', ' ')
    c = edge_tts.Communicate(text, 'he-IL-AvriNeural', rate='+20%', boundary='WordBoundary')
    words = []
    with open(sys.argv[2], 'wb') as f:
        async for ch in c.stream():
            if ch['type'] == 'audio': f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    json.dump(words, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
asyncio.run(main())
