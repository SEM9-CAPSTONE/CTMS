"""Local OSM renderer: raw Overpass JSON -> Web Mercator PNG -> TMS MBTiles.
No provider tiles, no elevation/contours. Requires Pillow only.
"""
import argparse
import collections
from contextlib import closing
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

BOUNDS = (108.225, 16.065, 108.335, 16.165)
ENDPOINT = os.environ.get('OFFLINE_BASEMAP_OSM_URL', 'https://overpass-api.de/api/interpreter')
ATTRIBUTION = '© OpenStreetMap contributors'
LICENSE = 'https://www.openstreetmap.org/copyright'

def project(lon, lat, zoom):
    lat = max(-85.05112878, min(85.05112878, lat))
    world = 256 * 2 ** zoom
    return ((lon + 180) / 360 * world,
            (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * world)

def tile_range(bounds, zoom):
    west, south, east, north = bounds
    x0, y0 = project(west, north, zoom)
    x1, y1 = project(east, south, zoom)
    return range(int(x0 // 256), int(x1 // 256) + 1), range(int(y0 // 256), int(y1 // 256) + 1)

def preflight(bounds):
    if len(bounds) != 4 or not all(math.isfinite(v) for v in bounds):
        raise RuntimeError('BOUNDS_INVALID')
    w,s,e,n = bounds
    if not (-180<=w<e<=180 and -85<s<n<85):
        raise RuntimeError('REGION_UNSUPPORTED')
    width = (e-w)*111320*math.cos(math.radians(0 if s<=0<=n else min(abs(s),abs(n))))
    if (n-s)*111320>50000 or width>50000:
        raise RuntimeError('REGION_TOO_LARGE')
    counts = {z:len(tile_range(bounds,z)[0])*len(tile_range(bounds,z)[1]) for z in range(12,17)}
    if sum(counts.values())>5000:
        raise RuntimeError('TILE_LIMIT_EXCEEDED')
    return counts

def download(path):
    # Larger extract prevents polygon edges being mistaken for clipping boundaries.
    w,s,e,n = BOUNDS
    query = f'[out:json][timeout:180];(way({s-.03},{w-.03},{n+.03},{e+.03}););out geom;'
    request = urllib.request.Request(ENDPOINT,
        data=urllib.parse.urlencode({'data': query}).encode(),
        headers={'User-Agent': 'CTMS-offline-basemap-worker/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=210) as response:
        payload = response.read(64 * 1024 * 1024 + 1)
    if len(payload) > 64 * 1024 * 1024:
        raise RuntimeError('OSM extract exceeds 64 MiB')
    data = json.loads(payload)
    if data.get('remark') or not data.get('elements'):
        raise RuntimeError(data.get('remark', 'Empty OSM extract'))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    path.with_suffix('.source.json').write_text(json.dumps({
        'endpoint': ENDPOINT, 'query': query, 'downloadedAt': datetime.now(timezone.utc).isoformat(),
        'sha256': hashlib.sha256(payload).hexdigest(), 'license': LICENSE,
        'osmTimestamp': data.get('osm3s', {}).get('timestamp_osm_base'),
    }, indent=2), encoding='utf-8')

def font(size):
    for candidate in ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                      '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf']:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

def road_style(kind, zoom):
    """Hierarchy from OSM tags, not an inferred trail/safety classification."""
    factor = 1.0 if zoom >= 15 else .7 if zoom == 14 else .45
    if kind in ['motorway','trunk','primary','primary_link','trunk_link']:
        return '#e5ba73', '#fff0bd', max(2,round(6*factor)), False
    if kind in ['secondary','tertiary','secondary_link','tertiary_link']:
        return '#d9bda0', '#fff8df', max(2,round(5*factor)), False
    if kind in ['path','footway','steps','track','bridleway']:
        return '#faf7eb', '#9b7650', max(1,round(2*factor)), True
    return '#d0d2cd', '#ffffff', max(1,round(3*factor)), False

def dashed_line(draw, points, fill, width):
    # Carry phase across segments to avoid restarting the dash at every vertex.
    phase=0.0
    for (ax,ay),(bx,by) in zip(points,points[1:]):
        length=math.hypot(bx-ax,by-ay)
        if not length: continue
        position=0.0
        while position<length:
            step=min(length-position,6-(phase%6))
            if phase%12<6:
                draw.line([(ax+(bx-ax)*position/length,ay+(by-ay)*position/length),
                    (ax+(bx-ax)*(position+step)/length,ay+(by-ay)*(position+step)/length)],fill=fill,width=width)
            position+=step; phase+=step

def render(data, output):
    preflight(BOUNDS)
    ways = [e for e in data['elements'] if e.get('type') == 'way' and len(e.get('geometry', [])) > 1]
    counts = collections.Counter(e.get('tags', {}).get('highway') for e in ways if 'highway' in e.get('tags', {}))
    temp = output.with_suffix('.partial')
    if temp.exists():
        temp.unlink()
    db = sqlite3.connect(temp)
    db.executescript('CREATE TABLE metadata(name TEXT PRIMARY KEY,value TEXT); CREATE TABLE tiles(zoom_level INTEGER,tile_column INTEGER,tile_row INTEGER,tile_data BLOB,PRIMARY KEY(zoom_level,tile_column,tile_row));')
    metadata = {'name':'CTMS route offline basemap','format':'png','type':'baselayer','version':'1.0',
        'bounds':','.join(map(str, BOUNDS)), 'minzoom':'12','maxzoom':'16',
        'attribution':ATTRIBUTION, 'license':LICENSE,
        'description':'Local raster rendering of OSM ways; no DEM, no contours, no claim of complete trail coverage.',
        'source':'Raw OSM ways via Overpass; see companion source.json'}
    db.executemany('INSERT INTO metadata VALUES(?,?)', metadata.items())
    per_zoom = {}
    preview = None
    for z in range(12, 17):
        xs, ys = tile_range(BOUNDS,z)
        left, top = xs.start * 256, ys.start * 256
        # One canvas per zoom avoids tile-edge seams. Not used by the mobile reader.
        im = Image.new('RGB',(len(xs)*256,len(ys)*256),'#f5f3eb')
        draw = ImageDraw.Draw(im)
        projected = []
        for way in ways:
            pts = [(project(p['lon'],p['lat'],z)[0]-left,project(p['lon'],p['lat'],z)[1]-top) for p in way['geometry'] if p.get('lat') is not None]
            if len(pts)<2: continue
            bbox = (min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts))
            if bbox[2]<0 or bbox[3]<0 or bbox[0]>im.width or bbox[1]>im.height: continue
            tags = way.get('tags',{})
            projected.append((way,tags,pts))
            closed = way.get('nodes',[None])[0] == way.get('nodes',[0])[-1]
            fill = None
            if tags.get('natural') in ['wood','scrub'] or tags.get('landuse') in ['forest','grass','meadow']: fill='#cde2bd'
            if tags.get('natural')=='water' or tags.get('water') or tags.get('landuse')=='reservoir': fill='#a6d7e7'
            if tags.get('building') and z>=15: fill='#ded4c8'
            if tags.get('landuse')=='residential': fill='#ebe7dd'
            if closed and fill: draw.polygon(pts,fill=fill)
        # Raw coastline is a line only: never invent a sea polygon or terrain.
        for way,tags,pts in projected:
            if tags.get('waterway') or tags.get('natural')=='coastline': draw.line(pts,fill='#70b6d0',width=2)
            road = tags.get('highway')
            if road:
                casing,color,width,dashed=road_style(road,z)
                draw.line(pts,fill=casing,width=width+2,joint='curve')
                if dashed: dashed_line(draw,pts,color,width)
                else: draw.line(pts,fill=color,width=width,joint='curve')
        occupied=[]
        for way,tags,pts in projected:
            label=tags.get('name')
            if not label or z<14 or not (tags.get('highway') or tags.get('natural')): continue
            x,y=pts[len(pts)//2]
            if x<10 or y<10 or x>im.width-120 or y>im.height-20: continue
            label_font=font(13 if z>=15 else 12)
            box=draw.textbbox((x,y),label,font=label_font)
            if any(not (box[2]+8<a or box[0]-8>c or box[3]+5<b or box[1]-5>d) for a,b,c,d in occupied): continue
            draw.text((x,y),label,font=label_font,fill='#40534a',stroke_width=2,stroke_fill='#fffef8')
            occupied.append(box)
        for x in xs:
            for y in ys:
                tile=im.crop(((x-xs.start)*256,(y-ys.start)*256,(x-xs.start+1)*256,(y-ys.start+1)*256))
                buf=io.BytesIO(); tile.save(buf,format='PNG',optimize=True)
                db.execute('INSERT INTO tiles VALUES(?,?,?,?)',(z,x,(1<<z)-1-y,buf.getvalue()))
        per_zoom[z]=len(xs)*len(ys)
        if z==15:
            preview=im.copy(); preview.thumbnail((1500,1500)); preview.save(output.with_suffix('.preview.png'))
        print(f'z{z}: {per_zoom[z]} tiles',flush=True)
    db.commit(); db.close(); temp.replace(output)
    report = validate(output)
    report['highwayWaysInExtract']=dict(counts)
    report['osmWaysInExtract']=len(ways)
    report['limitations']=['No DEM or contours','Ways-only renderer: no multipolygon relation assembly','Water background is not inferred from open coastline','Tile diversity is a heuristic, not proof of correctness']
    output.with_suffix('.report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)

def validate(path):
    preflight(BOUNDS)
    if path.stat().st_size>100*1024*1024: raise RuntimeError('ARTIFACT_TOO_LARGE')
    with closing(sqlite3.connect(f'file:{path.as_posix()}?mode=ro',uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise RuntimeError('SQLite invalid')
        hashes=collections.Counter(); actual={}
        for z in range(12,17):
            xs,ys=tile_range(BOUNDS,z)
            expected={(x,(1<<z)-1-y) for x in xs for y in ys}
            rows=db.execute('SELECT tile_column,tile_row,tile_data FROM tiles WHERE zoom_level=?',(z,)).fetchall()
            if {(x,y) for x,y,_ in rows}!=expected: raise RuntimeError(f'Tile coverage mismatch at z{z}')
            actual[z]=len(rows)
            for x,y,payload in rows:
                with Image.open(io.BytesIO(payload)) as im:
                    if im.size!=(256,256) or im.format!='PNG': raise RuntimeError('Unexpected tile format or size')
                    im.verify()
                hashes[hashlib.sha256(payload).hexdigest()]+=1
    total=sum(actual.values()); dominant=max(hashes.values())/total
    if dominant>=0.95: raise RuntimeError('Placeholder suspected: >=95% tiles identical')
    with closing(sqlite3.connect(f'file:{path.as_posix()}?mode=ro',uri=True)) as db:
        metadata=dict(db.execute('SELECT name,value FROM metadata'))
        if (metadata.get('format')!='png' or metadata.get('minzoom')!='12' or metadata.get('maxzoom')!='16'
            or metadata.get('attribution')!=ATTRIBUTION or metadata.get('license')!=LICENSE
            or tuple(map(float,metadata.get('bounds','').split(',')))!=tuple(BOUNDS)):
            raise RuntimeError('METADATA_INVALID')
    return {'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'tiles':total,'perZoom':actual,'uniqueTileHashes':len(hashes),'dominantHashFraction':dominant,
        'bounds':BOUNDS,'attribution':ATTRIBUTION,'license':LICENSE,'coverage':'Every tile cell in bounds exists; not proof that OSM features are complete'}

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--download',action='store_true'); p.add_argument('--validate',action='store_true')
    p.add_argument('--source',type=Path,default=Path('artifacts/osm-offline/son-tra.json'))
    p.add_argument('--output',type=Path,default=Path('artifacts/osm-offline/son_tra.mbtiles'))
    p.add_argument('--bounds',type=float,nargs=4,metavar=('WEST','SOUTH','EAST','NORTH'),default=BOUNDS)
    a=p.parse_args(); BOUNDS=tuple(a.bounds)
    try: preflight(BOUNDS)
    except RuntimeError as error: p.error(str(error))
    a.output.parent.mkdir(parents=True,exist_ok=True)
    if a.validate: print(json.dumps(validate(a.output),indent=2))
    else:
        if a.download: download(a.source)
        render(json.loads(a.source.read_text(encoding='utf-8')),a.output)
