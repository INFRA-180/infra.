# Extraits « ton morceau » du Mix Samples (M3, 27/11/2026, Claude). À copier dans
# INVENTAIRE_SAMPLES/_outils/extraits_morceaux.py (même dossier que fort.py et publie.py). PAS ENCORE LANCÉ.
#
# Pour chaque entrée d'un sample dans un morceau INFRA (Mix : sample → ton morceau), découpe LA MINUTE que
# le Mix joue : de (entrée − 4 s) à (entrée + 64 s), entrée = go (moment fort, fort.py) sinon at. Source :
# le fichier publié du morceau (même flux que le site, lu par ffmpeg, rien d'autre n'est lu), comme fort.py.
# Encodage identique aux extraits des samples (_private/samples-extraits/build-extraits.js) : AAC 256 k,
# 44,1 kHz stéréo, faststart, fondus de 0,03 s aux bords (pas de clic).
#
# Sorties (locales, rien n'est envoyé) :
#   _outils/extraits_morceaux/<nom>.m4a          les extraits (≈ 2,2 Mo chacun)
#   _outils/extraits_morceaux.json               { "<album>|<titre>|<entrée>": [nom, début, durée] }
# Puis, avec le oui d'INFRA seulement :
#   1. envoi sur R2, clé assets/music/streams/samples/t/<nom>.m4a (voir --r2 : la commande est affichée,
#      jamais lancée) ;
#   2. publie.py : ajouter le champ tx à chaque item du Mix (voir --publie : le code à coller est affiché) ;
#   3. le site lit tx (samples.js, txOf / trackSeg) ; sans tx il lit le fichier entier en flux (repli).
#
# Usage : python3 extraits_morceaux.py [--tout] [--r2] [--publie]
#   --tout   refait aussi les extraits déjà présents (sinon reprend là où il s'est arrêté)
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

D = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(D, '..', '..', 'SITE', 'public', 'data')
BASE = 'https://infra180-api.pages.dev/audio/'
OUT = os.path.join(D, 'extraits_morceaux')
OUT_JSON = os.path.join(D, 'extraits_morceaux.json')
PAD, MINUTE = 4.0, 60.0                     # marge de chaque côté, minute jouée par le Mix (TRACK)
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

if '--publie' in sys.argv:
    print('''# publie.py : après le chargement de FORT, ajouter :
TX = json.load(open(os.path.join(D, 'extraits_morceaux.json'))) if os.path.exists(os.path.join(D, 'extraits_morceaux.json')) else {}
# puis là où « go » est posé sur un item (it['go'] = go), juste après :
#     e = it.get('go', tp['at'])
#     tx = TX.get('%s|%s|%s' % (album_title, track_title, num(e)))
#     if tx: it['tx'] = tx
# (même clé que ce script : album|titre|entrée, entrée = go sinon at, arrondie comme num()).''')
    sys.exit(0)
if '--r2' in sys.argv:
    print('''# Envoi sur R2 (à lancer depuis SITE/, avec le oui d'INFRA seulement) :
for f in ../INVENTAIRE_SAMPLES/_outils/extraits_morceaux/*.m4a; do
  node_modules/.bin/wrangler r2 object put "infra-audio/assets/music/streams/samples/t/${f:t}" --file "$f" \\
    --content-type audio/mp4 --cache-control "public, max-age=31536000, immutable" --remote
done''')
    sys.exit(0)


def num(v):
    v = round(float(v), 3)
    return int(v) if v == int(v) else v


def nom(src, entree):
    # alexandria/01-335i.m4a, entrée 70,5 s → alexandria_01-335i_705 (lettres, chiffres, - et _ seulement)
    parts = src.split('/')
    base = '_'.join(parts[-2:])[: -len('.m4a')] if src.endswith('.m4a') else '_'.join(parts[-2:])
    base = re.sub(r'[^\w-]+', '-', base, flags=re.ASCII).strip('-')
    return '%s_%d' % (base, round(entree * 10))


S = json.load(open(os.path.join(SITE, 'samples.json')))
T = json.load(open(os.path.join(SITE, 'tracks.json')))
src = {(a['title'], t['title']): t['src'] for a in T['albums'] for t in a['tracks']}
jobs = {}
for a in S['albums']:
    for t in a['tracks']:
        s = src.get((a['title'], t['title']))
        if not s:
            continue
        for it in t['items']:
            if it.get('v') or 'at' not in it or 's0' not in it:
                continue                     # voix et sons sans temps : pas dans le Mix
            e = float(it.get('go', it['at']))
            jobs['%s|%s|%s' % (a['title'], t['title'], num(e))] = (s, e)

done = json.load(open(OUT_JSON)) if os.path.exists(OUT_JSON) and '--tout' not in sys.argv else {}
os.makedirs(OUT, exist_ok=True)


def duree(path):
    r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True, timeout=60)
    return float(r.stdout.strip())


def coupe(item):
    key, (s, e) = item
    a = max(0.0, e - PAD)
    L = (e + MINUTE + PAD) - a
    name = nom(s, e)
    out = os.path.join(OUT, name + '.m4a')
    if not os.path.exists(out) or '--tout' in sys.argv:
        cmd = [FFMPEG, '-v', 'error', '-y', '-ss', str(a), '-t', str(L), '-i', BASE + s, '-vn', '-map_metadata', '-1',
               '-af', 'afade=t=in:d=0.03,afade=t=out:st=%s:d=0.03' % max(0.0, L - 0.03),
               '-ac', '2', '-ar', '44100', '-c:a', 'aac_at', '-b:a', '256k', '-movflags', '+faststart', out]
        try:
            subprocess.run(cmd, capture_output=True, timeout=180, check=True)
        except Exception as err:
            return key, None, str(err)[:200]
    try:
        d = duree(out)                       # morceau plus court que la minute : durée réelle
    except Exception as err:
        return key, None, str(err)[:200]
    if d < PAD + 5:
        return key, None, 'extrait trop court (%.1f s)' % d
    return key, [name, num(a), num(round(d, 3))], None


todo = [(k, v) for k, v in sorted(jobs.items()) if k not in done]
print(len(jobs), 'entrées ;', len(todo), 'à découper', flush=True)
err = []
with ThreadPoolExecutor(3) as ex:
    for n, (key, tx, e) in enumerate(ex.map(coupe, todo), 1):
        if tx:
            done[key] = tx
        else:
            err.append((key, e))
        if n % 20 == 0:
            json.dump(done, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
            print(n, flush=True)
json.dump(done, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
mo = sum(os.path.getsize(os.path.join(OUT, v[0] + '.m4a')) for v in done.values()
         if os.path.exists(os.path.join(OUT, v[0] + '.m4a'))) / 1048576
print(len(done), 'extraits ;', len(err), 'erreurs ; %.0f Mo' % mo)
for k, e in err[:10]:
    print(' -', k, ':', e)
