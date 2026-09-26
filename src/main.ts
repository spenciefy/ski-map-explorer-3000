import { ratingMarkup } from './trail-rating';
import {updateSocialMetadata} from './social';
import { resortLogo } from './resort-identity';
import { setupCollection } from './collection';
import { mountainRoute } from './routing';
import { defaultRiderSettings, normalizeRiderSettings, type RiderSettings } from './rider-settings';
import { liftDescription } from './mountain-models';
import './style.css';
import './art.css';
import './gallery.css';
import { AtlasScene } from './scene';
import { mapReferences, mapsLink, inExtent, difficultyNames, trailColor, featureLength, featureTitle, type MountainData, type MapPlace, type MapFeature } from './geography';
import { resorts, demoWeather, type Region, type Pass, type Resort } from './data';
import { loadForecasts, snowTotal, type Forecast } from './weather';
const projectName='topo.ski';
const savedKey='ski-map-explorer-3000:saved';
const icons:Record<string,string>={
 mountain:'<path d="m2 19 7-13 5 8 3-5 5 10H2Z"/><path d="m6 12 3 2 3-2"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M18 19l-1-4 4-1M3 14l4 1-1 4M18 5l-1 4 4 1"/>',
 wind:'<path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M5 17h5a2 2 0 1 1-2 2"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 sound:'<path d="m11 4-5 4H2v8h4l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 muted:'<path d="m11 4-5 4H2v8h4l5 4V4Zm5 5 6 6m0-6-6 6"/>',
 play:'<path d="m8 4 12 8-12 8V4Z"/>',pause:'<path d="M8 4v16M16 4v16"/>',
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
 cloud:'<path d="M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 3 3.5 3.5 0 0 1 0 7H7Z"/>',
 'chevron-left':'<path d="m15 18-6-6 6-6"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
};
function icon(name:string,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.mountain}</svg>`;}
let region:Region='north-america',pass:Pass='all',selected='powder',live=false,hour=17,playing=false,weatherLoading=false,weatherError=false;
let forecasts=new Map<string,Forecast>(),requestId=0;
let saved:Set<string>;try{saved=new Set(JSON.parse(localStorage.getItem(savedKey)||localStorage.getItem('schema-map-explorer-3000:saved')||localStorage.getItem('chasing-winter:saved')||'[]'));}catch{saved=new Set();}
let wildlifeVisible=true;try{wildlifeVisible=localStorage.getItem('ski-map-explorer-3000:wildlife')!=='false';}catch{}
const riderSettingsKey='ski-map-explorer-3000:riders';
let riderSettings:RiderSettings;try{riderSettings=normalizeRiderSettings(JSON.parse(localStorage.getItem(riderSettingsKey)||localStorage.getItem('schema-map-explorer-3000:riders')||'null'));}catch{riderSettings={...defaultRiderSettings};}
let view:'atlas'|'saved'='atlas';
let explorer:'places'|'trails'|'lifts'|'stops'='places',mapFeatures:MapFeature[]=[],terrainData:MountainData|undefined,featureQuery='';
let activeFeature:MapFeature|undefined;
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
  <section id="mountain-gallery" aria-label="Mountains"><div class="gallery-heading"><h1><a id="collection-home" href="/">${projectName}</a></h1><div class="collection-tools"><label class="collection-search"><span class="sr-only">Search mountains</span><input id="mountain-search" type="search" placeholder="Search mountains" autocomplete="off" /></label><div class="collection-switch" role="group" aria-label="Collection view"><button data-collection-view="grid" aria-pressed="true">Grid</button><button data-collection-view="globe" aria-pressed="false">Globe</button></div></div><a id="collection-about" href="/about">About</a></div><span id="collection-status" class="sr-only" role="status"></span><p id="collection-empty" hidden></p><section id="globe-view" hidden aria-label="Mountains around the world"><div id="globe-canvas"></div><div id="globe-card" hidden></div><details class="globe-directory"><summary>Mountains</summary><div id="globe-results" aria-label="Choose a mountain"></div></details></section><article id="about-page" hidden><h2>A little closer to the mountains.</h2><p>topo.ski is a collection of mountains you can explore—made for remembering a great ski day and dreaming about the next one.</p><p>Inspired by painted trail maps, tiny skiers, and weekends in the snow.</p><p>Made by <a href="https://spenceryen.com">Spencer</a> and GPT-6 Astra.</p><h3>Behind the maps</h3><p>Real elevation and mapped trails, lifts, roads, and buildings. Trees, riders, and vehicles add an illustrative layer. This is an independent art project, not a navigation map.</p><p>Iwanai elevation and aerial photography created by editing <a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a>. Geography from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> and <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen</a>. Forest cover from <a href="https://doi.org/10.5281/zenodo.7254221">ESA WorldCover</a>. Globe coastlines from <a href="https://www.naturalearthdata.com/">Natural Earth</a>. Optional forecasts from <a href="https://open-meteo.com/">Open-Meteo</a>.</p><a href="https://github.com/spenciefy/ski-map-explorer-3000">View the project on GitHub</a></article><div class="mountain-grid">${resorts.map(r=>`<a class="mountain-tile" href="/${r.id}" aria-label="Explore ${r.name}"><div class="mountain-preview"><img src="/previews/${r.id}.png" alt="" width="720" height="520" loading="${resorts.indexOf(r)<6?'eager':'lazy'}" /></div><div class="tile-caption"><div class="tile-identity"><div class="tile-title"><h2>${r.name}</h2>${resortLogo(r.id)?`<img class="resort-logo" src="${resortLogo(r.id)}" alt="${r.name} logo" loading="lazy" decoding="async" />`:""}</div><span>${r.area}</span></div></div></a>`).join('')}</div><div class="gallery-footer"><span class="maker-credit">Made by <a href="https://spenceryen.com" target="_blank" rel="noopener">Spencer</a> and GPT-6 Astra</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen terrain</a><a href="https://doi.org/10.5281/zenodo.7254221" target="_blank" rel="noopener">ESA WorldCover</a></div></section>
  <div class="paper-grain" aria-hidden="true"></div><div id="scene"></div><div class="atmosphere"></div><div id="map-labels"></div>
  <header class="topbar">
    <button class="brand" id="brand-home" aria-label="Back to mountains">${icon('chevron-left')}</button>
    <nav class="main-nav" aria-label="Main navigation"><button class="nav-item active" id="atlas-tab">Explore</button><button class="nav-item" id="saved-tab">Saved <span id="saved-count">0</span></button></nav>
    <button class="weather-switch" id="weather-switch" aria-pressed="false"><span class="status-dot"></span><span id="mode-name">Demo weather</span><span class="switch-track"><span></span></span></button>
  </header>
  <main>
    <section class="intro"><h1 id="mountain-heading" tabindex="-1"></h1></section>
    <aside class="mountain-panel" id="field-guide" aria-label="Mountain field guide" hidden><button id="close-guide" aria-label="Close mountain field guide">×</button>
      <div class="panel-topline" hidden><span id="resort-index"></span></div>
      <div id="resort-detail"></div>
      <div class="nearby-heading"><span id="list-title">Mountains</span><span id="visible-count"></span></div>
      <div class="pass-filters" role="group" aria-label="Filter mountains by pass"><button data-pass="all" class="active" aria-pressed="true">All</button><button data-pass="ikon" aria-pressed="false">Ikon</button><button data-pass="epic" aria-pressed="false">Epic</button></div>
      <div class="explorer-tabs" role="group" aria-label="Mountain explorer"><button data-explorer="places" class="active">Mountains</button><button data-explorer="trails">Trails</button><button data-explorer="lifts">Lifts</button><button data-explorer="stops">Lodges</button></div><label class="trail-search" hidden><span class="sr-only">Search named trails or lifts</span><input id="feature-search" type="search" placeholder="Search trails" autocomplete="off"/></label><div id="resort-list" class="resort-list"></div>
      <div id="source-note" class="source-note"></div>
    </aside>
    <p class="touch-hint">Drag to pan · Pinch to zoom · Twist to rotate</p><div class="terrain-controls"><div class="interaction-modes" role="group" aria-label="Drag mode"><button id="pan-mode" class="active" aria-pressed="true" title="Drag to move across the mountain">Pan</button><button id="rotate-mode" aria-pressed="false" title="Drag to orbit the mountain">Rotate</button></div><div class="view-presets" role="group" aria-label="Map perspective"><button id="panorama-view" aria-label="3D trail-map view" class="active" aria-pressed="true">3D</button><button id="overhead-view" aria-label="Overhead map view" aria-pressed="false">2D</button></div><div class="layer-toggles" role="group" aria-label="Map layers"><button data-layer="trails" aria-pressed="true"><span class="layer-check">✓</span> Trails</button><button data-layer="lifts" aria-pressed="true"><span class="layer-check">✓</span> Lifts</button><button data-layer="roads" aria-pressed="true"><span class="layer-check">✓</span> Roads</button><button data-layer="places" aria-pressed="true"><span class="layer-check">✓</span> Lodges</button><button data-layer="labels" aria-pressed="false"><span class="layer-check">−</span> Names</button></div><a id="official-map" target="_blank" rel="noopener">Official trail map ↗</a><a id="google-map" target="_blank" rel="noopener">Google Maps ↗</a></div>
    <div class="terrain-status" id="terrain-status" role="status">Loading map…</div>
    <section id="route-card" class="route-card" hidden aria-label="Selected trail or lift"></section>
    <div class="map-tools" aria-label="Map controls"><button id="reset-view" title="Reset view" aria-label="Reset map view">${icon('compass')}</button><div class="zoom-tools"><button id="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button id="zoom-out" aria-label="Zoom out">${icon('minus')}</button></div><button id="motion-toggle" aria-label="Pause mountain animation" title="Pause mountain animation">${icon('pause')}</button><button id="sound-toggle" aria-label="Enable mountain ambience" aria-pressed="false" title="Mountain ambience">${icon('muted')}</button></div>
    <div class="compass-rose" aria-hidden="true"><span>N</span><svg viewBox="0 0 64 64"><path d="M32 9 37 32 32 55 27 32Z" fill="none" stroke="currentColor"/><path d="m9 32 23-5 23 5-23 5Z" fill="none" stroke="currentColor"/><path d="m32 9 5 23h-5Z" fill="currentColor"/></svg></div>
    <section class="bottom-deck" aria-label="Weather">
      <button id="settings-toggle" aria-expanded="false" aria-controls="rider-settings">Controls</button><button id="weather-drawer" aria-expanded="false" aria-controls="weather-timeline">Weather <span>＋</span></button><div class="timeline" id="weather-timeline" hidden><div class="timeline-heading"><span>${icon('snow')}<span id="timeline-title">Demo weekend</span></span><output id="time-label" for="time-slider">Saturday, 9 am</output></div><div class="timeline-controls"><button id="timeline-play" aria-label="Play weekend forecast">${icon('play')}</button><div class="slider-wrap"><input id="time-slider" type="range" min="0" max="48" step="1" value="17" aria-label="Explore forecast time"/><div class="time-ticks"><span id="tick-start">FRI · 4 PM</span><span id="tick-mid">SATURDAY</span><span id="tick-end">SUN · 4 PM</span></div></div></div></div>
    </section>
    <aside id="rider-settings" class="rider-settings" aria-labelledby="settings-title" hidden>
      <div class="settings-heading"><h2 id="settings-title">Controls</h2><button id="close-settings" aria-label="Close settings">${icon('close')}</button></div>
      ${(['skier','snowboarder'] as const).map(kind=>`<fieldset><legend>${kind==='skier'?'Skiers':'Snowboarders'}</legend><label class="settings-visibility"><span>Visible</span><input id="${kind}-visible" type="checkbox" data-rider-setting="${kind==='skier'?'skiers':'snowboarders'}" /></label><label class="settings-range" for="${kind}-size"><span>Size <output id="${kind}-size-value" for="${kind}-size"></output></span><input id="${kind}-size" data-rider-setting="${kind}Size" type="range" min="0.5" max="2" step="0.05" /></label><label class="settings-range" for="${kind}-speed"><span>Speed <output id="${kind}-speed-value" for="${kind}-speed"></output></span><input id="${kind}-speed" data-rider-setting="${kind}Speed" type="range" min="0" max="3" step="0.1" /></label></fieldset>`).join('')}
      <fieldset class="ecology-settings"><legend>Nature</legend><p id="ecology-description"></p><label class="settings-visibility"><span>Wildlife</span><input id="wildlife-visible" type="checkbox" checked /></label></fieldset>
      <p id="rider-settings-note">Size and speed are relative to the default.</p><button id="reset-rider-settings">Reset</button>
    </aside>
  </main>
  <footer><span class="maker-credit">Made by <a href="https://spenceryen.com" target="_blank" rel="noopener">Spencer</a> and GPT-6 Astra</span><span class="rotation-hint">Hold ⌘ and drag to rotate</span></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="about-dialog"><button id="close-about" aria-label="Close data notes">${icon('close')}</button><h2>Sources</h2><p>Iwanai: elevation and aerial photography created by editing <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">GSI Tiles</a>. DEM10B has a 10 m source resolution, sampled to a 13 × 18 m display grid; Mapzen fills elevation gaps. Aerial imagery is a mosaic, not live conditions. Other terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen</a>. Trails, lifts, roads and buildings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap · ODbL</a>. Forest cover: <a href="https://doi.org/10.5281/zenodo.7254221" target="_blank" rel="noopener">ESA WorldCover · CC BY 4.0</a>.</p><p>Terrain and routes use mapped coordinates. Trees, regional species mixes, wildlife, building heights, lift structures and moving riders are illustrative. Lift capacities link to their sources; missing specs and retired lifts are labeled. Coverage and conditions can differ from the official trail map.</p><p>Demo weather is simulated. Live weather uses <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> forecasts, not observed snowfall or lift status. Pass access varies by season and pass.</p><p><a id="download-geodata" download>Download mountain data ↗</a></p></dialog>`;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
// Keep the map quiet: existing accessible controls live in one collapsible panel.
const mapOptions=document.createElement('section');mapOptions.className='map-options';
mapOptions.setAttribute('aria-label','Map controls');
for(const selector of ['.main-nav','.terrain-controls','.map-tools'])mapOptions.append($(selector));
$('#rider-settings').insertBefore(mapOptions,$('#rider-settings fieldset'));
const weatherOptions=document.createElement('section');weatherOptions.className='weather-options';
weatherOptions.setAttribute('aria-label','Weather controls');
for(const selector of ['#weather-switch','#weather-drawer','#weather-timeline'])weatherOptions.append($(selector));
mapOptions.after(weatherOptions);
const snowcatButton=document.createElement('button');snowcatButton.id='snowcat-view';snowcatButton.textContent='Illustrative snowcats';snowcatButton.hidden=true;snowcatButton.onclick=()=>{atlas?.focusSnowcats();toggleSettings(false);};mapOptions.append(snowcatButton);
// Keep mobile credits accessible without reserving a strip beneath the map.
const mapFooter=$('footer');
const detailBottom=document.createElement('div');detailBottom.className='detail-bottom';$('#app').append(detailBottom);
const detailControls=$('.bottom-deck');
$('.topbar').append($('.intro'));
const mapAttribution=document.createElement('div');mapAttribution.className='map-source-credits';mapAttribution.innerHTML='<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen</a>';
$('#rider-settings').append(mapAttribution);
const compactMap=matchMedia('(max-width:760px), (max-width:1024px) and (pointer:coarse), (max-height:520px) and (pointer:coarse)');
function placeMapCredits(){$('#app').append(detailControls);if(compactMap.matches)$('#rider-settings').append(mapFooter);else detailBottom.append(mapFooter);}
compactMap.addEventListener('change',placeMapCredits);placeMapCredits();
const identity=document.createElement('a');identity.className='resort-identity';identity.target='_blank';identity.rel='noopener';identity.hidden=true;$('.intro').prepend(identity);
const collection=setupCollection(goTo);
let atlas:AtlasScene | undefined;
function ensureAtlas(){if(atlas)return;try{atlas=new AtlasScene($('#scene'),$('#map-labels'),id=>selectResort(id,true));atlas.riderSettings={...riderSettings};atlas.showWildlife=wildlifeVisible;}catch{$('#scene').innerHTML='<div class="canvas-error">3D map unavailable. Try a browser with WebGL enabled.</div>';}}
const iwanaiTools=document.createElement('div');iwanaiTools.className='iwanai-tools';iwanaiTools.hidden=true;
iwanaiTools.innerHTML='<div class="iwanai-view-switch"><button data-iwanai-view="slopes" aria-pressed="true">Lift & runs</button><button data-iwanai-view="mountain" aria-pressed="false">Mountain</button><button id="iwanai-access">Access map</button><select id="iwanai-surface" aria-label="Map appearance"><option value="aerial">Aerial</option><option value="art">Winter</option></select></div><span>CAT routes & boundaries not mapped in 3D</span>';
$('#app').append(iwanaiTools);
$<HTMLSelectElement>('#iwanai-surface').onchange=event=>atlas?.setAerial((event.target as HTMLSelectElement).value==='aerial');
window.addEventListener('imagery-error',()=>{$<HTMLSelectElement>('#iwanai-surface').value='art';notify('Aerial image unavailable. Showing winter art.');});

const accessDialog=document.createElement('dialog');accessDialog.className='access-dialog';accessDialog.setAttribute('aria-labelledby','access-title');
accessDialog.innerHTML='<button class="access-close" aria-label="Close access map">×</button><h2 id="access-title">Iwanai access</h2><p><strong>Chairlift:</strong> Courses A, B and C. No hiking from the lift top.</p><p><strong>CAT terrain:</strong> guided access, chosen by the resort for conditions. CAT roads and pickup points are not verified in this 3D map. The snowcat models are illustrative.</p><p><strong>Touring:</strong> the resort prohibits touring within its designated CAT zone. Consult the official access map below and check with the resort.</p><a href="https://iwanairesort.com/en/-catski-safety-niseko" target="_blank" rel="noopener">Official access rules and map</a><div id="access-image"></div><p class="access-note">Official illustration, not a georeferenced boundary. Unmarked terrain in topo.ski does not indicate permission to ski.</p>';
$('#app').append(accessDialog);accessDialog.querySelector('button')!.onclick=()=>accessDialog.close();
$('#iwanai-access').onclick=()=>{if(!$('#access-image').childElementCount){const img=document.createElement('img');img.src='https://images.squarespace-cdn.com/content/v1/59eac661fe54efb793a14c87/fb0949e1-77b3-4511-a6e6-c35bd787e592/Hikers%2BMap-01.png';img.alt='Official Iwanai illustration distinguishing resort terrain restricted to authorized skiing from the public touring side.';$('#access-image').append(img);}accessDialog.showModal();};
iwanaiTools.querySelectorAll<HTMLButtonElement>('[data-iwanai-view]').forEach(button=>button.onclick=()=>{if(!atlas)return;atlas.iwanaiOverview=button.dataset.iwanaiView==='mountain';atlas.home();iwanaiTools.querySelectorAll('[data-iwanai-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
let galleryScroll=0;
function navigate(){updateSocialMetadata(location.pathname);toggleSettings(false);const id=mountainRoute(location.pathname,location.hash);if(id&&(location.pathname!=='/'+id||location.hash))history.replaceState(null,'','/'+id+location.search);const resort=resorts.find(r=>r.id===id);const gallery=!resort;document.body.classList.toggle('iwanai-map',resort?.id==='iwanai');iwanaiTools.hidden=resort?.id!=='iwanai';if(resort&&document.body.classList.contains('gallery-view'))galleryScroll=window.scrollY;document.body.classList.toggle('gallery-view',gallery);$('#mountain-gallery').hidden=!gallery;const aboutRoute=location.pathname.replace(/\/$/,'')==='/about';collection.setRoute(aboutRoute,gallery);
 if(gallery){playing=false;$('#timeline-play').innerHTML=icon('play');$('#timeline-play').setAttribute('aria-label','Play forecast timeline');document.title=aboutRoute?'About · '+projectName:projectName;toggleGuide(false);if(atlas)atlas.suspended=true;requestAnimationFrame(()=>{window.scrollTo(0,aboutRoute?0:galleryScroll);if(atlas&&!aboutRoute)document.querySelector<HTMLAnchorElement>(`a[href="/${selected}"]`)?.focus({preventScroll:true});});return;}
 window.scrollTo(0,0);toggleGuide(false);$('#route-card').hidden=true;activeFeature=undefined;ensureAtlas();region=resort.region;selected=resort.id;view='atlas';explorer='places';pass='all';if(atlas){atlas.suspended=false;atlas.resize();atlas.setRegion(currentRegion());}if(live&&!forecasts.has(resort.id))void fetchWeather();else render();const logo=resortLogo(resort.id);identity.hidden=!logo;identity.href=resort.url;identity.replaceChildren();if(logo){const img=document.createElement('img');img.src=logo;img.alt=resort.name;identity.append(img);identity.setAttribute('aria-label',resort.name+' official website');}document.title=resort.name+' · '+projectName;$('#mountain-heading').focus({preventScroll:true});
}
function goTo(path:string){history.pushState(null,'',path);navigate();}
function showGallery(){goTo('/');}
window.addEventListener('hashchange',navigate);
window.addEventListener('popstate',navigate);
$('#mountain-gallery').addEventListener('click',event=>{
 const link=(event.target as HTMLElement).closest<HTMLAnchorElement>('a.mountain-tile');
 if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();goTo(link.pathname);
});
function currentRegion(){return resorts.filter(r=>r.region===region);}
function visibleResorts(){return currentRegion().filter(r=>(pass==='all'||r.pass===pass)&&(view!=='saved'||saved.has(r.id)));}
function getResort(){return resorts.find(r=>r.id===selected)!;}
function total(r:Resort){if(!live)return r.snow;const f=forecasts.get(r.id);return f&&!weatherLoading&&!weatherError?snowTotal(f):null;}
function formatTotal(r:Resort){const n=total(r);return n===null?'—':`${n}`;}
function conditions(r:Resort){if(!live)return demoWeather(r,16+hour);const f=forecasts.get(r.id);if(!f||weatherError||weatherLoading)return null;const i=Math.min(hour,f.time.length-1);return {snow:snowTotal(f),temp:Math.round(f.temp[i]),wind:Math.round(f.wind[i]),cloud:f.cloud[i],snowfall:f.snow[i]};}
function renderDetail(){
 const r=getResort(),c=conditions(r),isSaved=saved.has(r.id),wx=!c?'cloud':c.snowfall>.2?'snow':c.cloud>55?'cloud':'sun';
 document.documentElement.style.setProperty('--easy-color','#'+trailColor(r.id,'easy').toString(16));document.documentElement.style.setProperty('--intermediate-color','#'+trailColor(r.id,'intermediate').toString(16));$('#mountain-heading').textContent=r.name;$('#snowcat-view').hidden=r.id!=='iwanai';
 $('#official-map').setAttribute('href',mapReferences[r.id].url);$('#official-map').textContent=(mapReferences[r.id].label||'Trail map')+' ↗';$('#google-map').setAttribute('href',`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`);$('#download-geodata').setAttribute('href',`/geodata/${r.id}.json`);
 $('#resort-index').textContent=`${String(currentRegion().findIndex(x=>x.id===r.id)+1).padStart(2,'0')} / ${String(currentRegion().length).padStart(2,'0')}`;
 $('#resort-detail').innerHTML=`<div class="place-label">${r.area.toUpperCase()} <span> / </span> ${r.country.toUpperCase()}</div><div class="resort-title"><h2>${r.name}</h2><button id="save-mountain" class="save-mountain ${isSaved?'saved':''}" aria-label="${isSaved?'Unsave':'Save'} ${r.name}" aria-pressed="${isSaved}">${icon('bookmark')}</button></div><div class="snow-report"><div class="snow-amount">${formatTotal(r)}<span>cm</span></div><div class="snow-caption">${icon(wx)}<span>${live?'next 72 hours':'demo snowfall'}</span></div></div><div class="condition-row"><span>${icon('sun')}${c?`${c.temp}°`:'—'}</span><span>${icon('wind')}${c?`${c.wind} km/h`:'—'}</span><span>${r.elevation.toLocaleString()} m <span class="alt-label">forecast elevation</span></span></div><div class="detail-actions"><button id="explore-mountain">Trails ${icon('arrow')}</button><a href="${r.url}" target="_blank" rel="noopener" aria-label="Visit ${r.name} official website">Resort ↗</a></div>`;
 if(r.id==='palisades')$('#resort-detail').insertAdjacentHTML('beforeend','<div class="mountain-sectors" aria-label="Explore Palisades and Alpine"><button data-sector="10478713">Palisades ↗</button><button data-sector="10481191">Alpine Meadows ↗</button><button data-sector="847810336">Base to Base ↗</button></div>');
 document.querySelectorAll<HTMLButtonElement>('[data-sector]').forEach(el=>el.onclick=()=>{if(!atlas?.data){notify('Loading map…');return;}atlas.focusFeature(Number(el.dataset.sector));toggleGuide(false);});
 $('#save-mountain').onclick=()=>{if(saved.has(r.id))saved.delete(r.id);else saved.add(r.id);try{localStorage.setItem(savedKey,JSON.stringify([...saved]));}catch{}render();$('#save-mountain').focus();notify(saved.has(r.id)?`${r.name} saved.`:`${r.name} removed.`);};
 $('#explore-mountain').onclick=()=>{explorer='trails';featureQuery='';$<HTMLInputElement>('#feature-search').value='';renderList();};
 $('#source-note').innerHTML=weatherLoading&&live?'<span class="loading-dot"></span> Loading forecast…':weatherError&&live?'<span>Forecast unavailable.</span> <button id="retry-weather">Try again ↗</button>':live?`<span class="status-dot live"></span> Modeled forecast · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a><br>Fetched ${new Date(forecasts.get(r.id)?.loadedAt||Date.now()).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ${r.elevation.toLocaleString()} m`:'<span class="demo-dot"></span> Simulated weather.';
 const retry=document.querySelector<HTMLButtonElement>('#retry-weather');if(retry)retry.onclick=fetchWeather;
}
function renderList(){
 document.querySelectorAll<HTMLButtonElement>('[data-explorer]').forEach(el=>{el.classList.toggle('active',el.dataset.explorer===explorer);el.setAttribute('aria-pressed',String(el.dataset.explorer===explorer));});$('.pass-filters').hidden=explorer!=='places';$('.trail-search').hidden=explorer==='places';
 if(explorer!=='places'){renderFeatureList();return;}
 const list=visibleResorts();$('#visible-count').textContent=String(list.length);$('#list-title').textContent=view==='saved'?'Saved':'Mountains';
 $('#resort-list').innerHTML=list.length?list.map((r,i)=>`<button class="resort-row ${selected===r.id?'active':''}" data-select="${r.id}" aria-pressed="${selected===r.id}"><span class="row-index">${String(i+1).padStart(2,'0')}</span><span class="row-title">${r.name}<span>${r.area} <b class="pass-tag ${r.pass}">${r.pass==='independent'?'IND.':r.pass.toUpperCase()}</b></span></span><span class="row-snow">${formatTotal(r)}<small>cm</small></span>${icon('arrow')}</button>`).join(''):`<div class="empty-state">${view==='saved'?'No saved mountains.':'No mountains match this pass in this region.'}</div>`;
 document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(el=>el.onclick=()=>selectResort(el.dataset.select!,false));
 atlas?.filter(new Set(document.body.classList.contains('mountain-focus')?[selected]:list.map(r=>r.id)));atlas?.markers.forEach(m=>{m.element.querySelector('.marker-snow')!.textContent=`${formatTotal(m.resort)} cm`;m.element.querySelector('.marker-period')!.textContent=live?' / 72 hours':' / demo';});
}
function render(){
 $('#saved-count').textContent=saved.size?String(saved.size):'';
 document.querySelectorAll<HTMLButtonElement>('[data-region]').forEach(el=>{el.classList.toggle('active',el.dataset.region===region);el.setAttribute('aria-pressed',String(el.dataset.region===region));});
 document.querySelectorAll<HTMLButtonElement>('[data-pass]').forEach(el=>{el.classList.toggle('active',el.dataset.pass===pass);el.setAttribute('aria-pressed',String(el.dataset.pass===pass));});
 $('#atlas-tab').classList.toggle('active',view==='atlas');$('#saved-tab').classList.toggle('active',view==='saved');
 renderDetail();renderList();updateTime();atlas?.select(selected);
}
function showMobileMap(){if(innerWidth<760)toggleGuide(false);}
function selectResort(id:string,fly=false){if(mountainRoute(location.pathname,location.hash)!==id){goTo('/'+id);return;}showMobileMap();selected=id;explorer='places';activeFeature=undefined;$('#route-card').hidden=true;atlas?.select(id,fly);renderDetail();renderList();updateTime();$('.mountain-panel').scrollTop=0;}
function setRegion(next:Region){document.body.classList.remove('mountain-focus');region=next;const available=visibleResorts();selected=(available[0]||currentRegion()[0]).id;atlas?.setRegion(currentRegion());if(live)fetchWeather();render();}
let toastTimer:ReturnType<typeof setTimeout>;
function notify(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3600);}
async function fetchWeather(){const id=++requestId;weatherLoading=true;weatherError=false;render();try{const result=await loadForecasts(currentRegion());if(id!==requestId||!live)return;forecasts=result;}catch(error){if(id!==requestId||!live)return;console.warn('Weather unavailable:',error);weatherError=true;notify('Forecast unavailable. Try again later.');}finally{if(id===requestId&&live){weatherLoading=false;render();}}}
function updateTime(){
 const c=conditions(getResort());let displayHour=16+hour,label='';
 if(live){const f=forecasts.get(selected);if(f&&!weatherLoading&&!weatherError){const time=new Date(f.time[Math.min(hour,f.time.length-1)]*1000);label=new Intl.DateTimeFormat('en-US',{weekday:'short',hour:'numeric',timeZone:f.timezone}).format(time);displayHour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:f.timezone}).format(time));}else label=weatherLoading?'Loading forecast…':'Forecast unavailable';}else{const h=(16+hour)%24;const day=['Friday','Saturday','Sunday'][Math.floor((16+hour)/24)];label=`${day}, ${h%12||12} ${h<12?'am':'pm'}`;}
 $('#time-label').textContent=label+(live?' · local':'');$('#time-slider').setAttribute('aria-valuetext',label);$('#timeline-title').textContent=live?'72-hour forecast':'Demo weekend';
 $('#tick-start').textContent=live?'NOW':'FRI · 4 PM';$('#tick-mid').textContent=live?'+ 36 HOURS':'SATURDAY';$('#tick-end').textContent=live?'+ 72 HOURS':'SUN · 4 PM';
 ($('#time-slider') as HTMLInputElement).max=live?'72':'48';($('#time-slider') as HTMLInputElement).value=String(hour);$('#time-slider').style.setProperty('--progress',`${hour/(live?72:48)*100}%`);
 atlas?.setWeather(displayHour,c?.snowfall||0,c?.wind||0,c?.cloud||0);
 document.body.classList.toggle('evening',displayHour%24<7||displayHour%24>18);
}
$('#weather-switch').onclick=()=>{live=!live;hour=live?0:17;weatherError=false;weatherLoading=false;$('#weather-switch').setAttribute('aria-pressed',String(live));$('#mode-name').textContent=live?'Live forecast':'Demo weather';$('#weather-switch').classList.toggle('is-live',live);if(live)fetchWeather();else{requestId++;render();}};
$('#time-slider').oninput=(event)=>{hour=Number((event.target as HTMLInputElement).value);renderDetail();updateTime();};
$('#timeline-play').onclick=()=>{playing=!playing;$('#timeline-play').innerHTML=icon(playing?'pause':'play');$('#timeline-play').setAttribute('aria-label',playing?'Pause forecast timeline':'Play forecast timeline');};
setInterval(()=>{if(playing&&!document.hidden){hour=(hour+1)%(live?73:49);renderDetail();updateTime();}},1100);
function goHome(){document.body.classList.remove('mountain-focus');$('#route-card').hidden=true;atlas?.home();renderList();}$('#reset-view').onclick=goHome;$('#brand-home').onclick=showGallery;$('#zoom-in').onclick=()=>atlas?.zoom(.8);$('#zoom-out').onclick=()=>atlas?.zoom(1.25);
$('#motion-toggle').onclick=()=>{if(!atlas)return;const wasPaused=atlas.paused||(atlas.reducedMotion&&!atlas.motionOverride);atlas.paused=!wasPaused;atlas.motionOverride=wasPaused;$('#motion-toggle').innerHTML=icon(atlas.paused?'play':'pause');$('#motion-toggle').setAttribute('aria-label',atlas.paused?'Resume mountain animation':'Pause mountain animation');};

for(const el of document.querySelectorAll<HTMLButtonElement>('[data-region]'))el.onclick=()=>setRegion(el.dataset.region as Region);
for(const el of document.querySelectorAll<HTMLButtonElement>('[data-pass]'))el.onclick=()=>{pass=el.dataset.pass as Pass;const list=visibleResorts();renderList();};
let guideTrigger:HTMLElement|null=null;
function toggleGuide(open:boolean){if(open)toggleSettings(false);if(open&&$('#field-guide').hidden)guideTrigger=$('#rider-settings').contains(document.activeElement)?$('#settings-toggle'):document.activeElement as HTMLElement;$('#field-guide').hidden=!open;document.body.classList.toggle('guide-open',open);$('#atlas-tab').setAttribute('aria-expanded',String(open));$('#saved-tab').setAttribute('aria-expanded',String(open&&view==='saved'));if(open)$('#close-guide').focus();}
$('#atlas-tab').setAttribute('aria-controls','field-guide');$('#atlas-tab').setAttribute('aria-expanded','false');
$('#atlas-tab').onclick=()=>{view='atlas';render();toggleGuide($('#field-guide').hidden);};$('#saved-tab').onclick=()=>{view='saved';explorer='places';renderList();toggleGuide(true);};
$('#close-guide').onclick=()=>{toggleGuide(false);guideTrigger?.focus();};
$('#weather-drawer').onclick=()=>{const open=$('#weather-timeline').hidden;$('#weather-timeline').hidden=!open;$('#weather-drawer').setAttribute('aria-expanded',String(open));$('#weather-drawer span').textContent=open?'−':'＋';};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#rider-settings').hidden){toggleSettings(false);$('#settings-toggle').focus();return;}if(!$('#field-guide').hidden){toggleGuide(false);guideTrigger?.focus();}else if(!$('#route-card').hidden){$('#route-card').hidden=true;atlas?.clearFocus();atlas?.renderer.domElement.focus();}else if(!$('#weather-timeline').hidden)$('#weather-drawer').focus();$('#weather-timeline').hidden=true;$('#weather-drawer').setAttribute('aria-expanded','false');$('#weather-drawer span').textContent='＋';}});
const dialog=$<HTMLDialogElement>('#about-dialog');$('#close-about').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
let audio:AudioContext|undefined,audioGain:GainNode|undefined,audioEnabled=false;
$('#sound-toggle').onclick=async()=>{try{if(!audio){audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate);const data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*3;}const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;audioGain=audio.createGain();audioGain.gain.value=0;source.connect(filter);filter.connect(audioGain);audioGain.connect(audio.destination);source.start();}await audio.resume();audioEnabled=!audioEnabled;audioGain!.gain.setTargetAtTime(audioEnabled?.16:0,audio.currentTime,.6);$('#sound-toggle').innerHTML=icon(audioEnabled?'sound':'muted');$('#sound-toggle').setAttribute('aria-pressed',String(audioEnabled));$('#sound-toggle').setAttribute('aria-label',audioEnabled?'Mute mountain ambience':'Enable mountain ambience');}catch{notify('Audio is unavailable in this browser.');}};

function escapeHtml(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function renderFeatureList(){
 if(explorer==='stops'){const items=(terrainData?.places||[]).filter(p=>inExtent(terrainData!,p.point)&&p.name.toLocaleLowerCase().includes(featureQuery.toLocaleLowerCase()));$('#list-title').textContent='Lodges';$('#visible-count').textContent=String(items.length);$('#resort-list').innerHTML=items.length?items.map((p,i)=>`<button class="feature-row" data-place-index="${i}"><span class="difficulty-symbol lodge">⌂</span><span>${escapeHtml(p.name)}<small>${escapeHtml(p.kind)}</small></span>${icon('arrow')}</button>`).join(''):`<div class="empty-state">${terrainData?'No lodges found.':'Loading lodges…'}</div>`;document.querySelectorAll<HTMLButtonElement>('[data-place-index]').forEach(el=>el.onclick=()=>atlas?.focusPlace(items[Number(el.dataset.placeIndex)]));return;}

 const kind=explorer==='lifts'?'lift':'trail';const q=featureQuery.trim().toLocaleLowerCase();const seen=new Set<string>();
 const items=mapFeatures.filter(f=>f.kind===kind&&f.name&&(!q||f.name.toLocaleLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name)).filter(f=>{const key=f.name+'|'+f.difficulty;if(seen.has(key))return false;seen.add(key);return true;});
 $('#list-title').textContent=explorer==='lifts'?'Lifts':'Trails';$('#visible-count').textContent=String(items.length);
 $('#resort-list').innerHTML=items.length?items.slice(0,180).map(f=>`<button class="feature-row ${activeFeature?.id===f.id?'active':''}" data-feature="${f.id}"><span class="difficulty-symbol ${f.kind==='lift'?'lift':f.difficulty}">${f.kind==='lift'?'↟':f.difficulty==='easy'||f.difficulty==='novice'?'●':f.difficulty==='intermediate'?'■':'◆'}</span><span>${escapeHtml(f.name)}<small>${f.kind==='lift'?(f.proposed?'Proposed':f.access==='private'?'Private access':escapeHtml(liftDescription(f))):(difficultyNames[f.difficulty]||'Unrated')} · ${(featureLength(f)/1000).toFixed(1)} km segment</small></span>${icon('arrow')}</button>`).join(''):`<div class="empty-state">${terrainData?'No routes found.':'Loading routes…'}</div>`;
 document.querySelectorAll<HTMLButtonElement>('[data-feature]').forEach(el=>el.onclick=()=>atlas?.focusFeature(Number(el.dataset.feature)));
}
window.addEventListener('terrain-loading',()=>{$<HTMLSelectElement>('#iwanai-surface').value='aerial';iwanaiTools.querySelectorAll<HTMLButtonElement>('[data-iwanai-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.iwanaiView==='slopes')));terrainData=undefined;mapFeatures=[];activeFeature=undefined;$('#route-card').hidden=true;$('#scene').setAttribute('aria-busy','true');$('#terrain-status').classList.add('loading');$('#terrain-status').textContent='Loading map…';$('#terrain-status').classList.remove('error');if(explorer!=='places')renderList();});
window.addEventListener('terrain-ready',(event)=>{$('#scene').setAttribute('aria-busy','false');$('#terrain-status').classList.remove('loading');renderRiderSettings();const detail=(event as CustomEvent).detail;terrainData=detail.data;const source=terrainData!.source;
 for(const link of document.querySelectorAll<HTMLAnchorElement>('footer a[href*="terrain-tiles"],footer a[data-terrain-source],.map-source-credits a[data-terrain-source],.map-source-credits a[href*="terrain-tiles"]')){link.dataset.terrainSource='true';link.href=source.terrainAttribution;link.textContent=detail.id==='iwanai'?'GSI · edited':'Mapzen terrain';}
 mapFeatures=detail.features;const liftNames=new Set(mapFeatures.filter(f=>f.kind==='lift'&&f.name).map(f=>f.name));const trailNames=new Set(mapFeatures.filter(f=>f.kind==='trail'&&f.name).map(f=>f.name));$('#terrain-status').textContent=`${trailNames.size} named runs · ${liftNames.size} mapped lifts · Real elevation`;$('#terrain-status').title=`${mapReferences[selected].coverage}. OSM snapshot ${terrainData!.source.osmTimestamp}. DEM grid spacing ${terrainData!.source.sampleSpacingMeters.join(' × ')} m; native resolution varies.`;if(explorer!=='places')renderList();});
window.addEventListener('terrain-error',()=>{$('#scene').setAttribute('aria-busy','false');$('#terrain-status').classList.remove('loading');$('#terrain-status').textContent='Terrain unavailable. Choose another mountain or reload.';$('#terrain-status').classList.add('error');});
window.addEventListener('feature-selected',(event)=>{const f=(event as CustomEvent<MapFeature>).detail;activeFeature=f;showMobileMap();const d=atlas?.data;const elevations=d?f.points.map(p=>atlas!.height(p[0]*atlas!.scale,p[1]*atlas!.scale)/atlas!.scale+atlas!.minElevation):[];const drop=elevations.length?Math.round(Math.abs(elevations[elevations.length-1]-elevations[0])):0;
 $('#route-card').hidden=false;$('#route-card').innerHTML=`<button id="close-route" aria-label="Close selected route">${icon('close')}</button><div class="eyebrow">${f.kind==='lift'?'Lift':'Trail'}</div><h3>${escapeHtml(featureTitle(f))}</h3>${f.kind==='trail'?ratingMarkup(selected,f):''}<p>${f.kind==='lift'?`${f.proposed?'Proposed · not animated':f.access==='private'?'Private access':escapeHtml(liftDescription(f))} · `:''}${f.area?'Trail area':`≈ ${(featureLength(f)/1000).toFixed(1)} km${f.kind==='trail'?' mapped segment':''}`} <span>·</span> ${drop} m ${f.kind==='lift'?'rise':'endpoint drop'}</p>${f.capacityNote?`<span class="route-source">${escapeHtml(f.capacityNote)}</span>`:''}${f.capacitySource?`<div class="place-links"><a href="${escapeHtml(f.capacitySource)}" target="_blank" rel="noopener">Lift capacity source ↗</a></div>`:''}${!f.retired&&!f.proposed&&f.access!=='private'?`<button id="follow-route">${icon('play')} ${f.kind==='lift'?'Ride':'Follow'}</button>`:''}`;
 $('#close-route').onclick=()=>{$('#route-card').hidden=true;atlas?.clearFocus();};const follow=document.querySelector<HTMLButtonElement>('#follow-route');if(follow)follow.onclick=()=>{if(atlas){atlas.paused=false;atlas.motionOverride=true;atlas.followSelected();$('#motion-toggle').innerHTML=icon('pause');$('#motion-toggle').setAttribute('aria-label','Pause mountain animation');}notify('Drag to stop following.');};
 if(explorer!=='places')renderList();
});
window.addEventListener('place-selected',(event)=>{const p=(event as CustomEvent<MapPlace>).detail;activeFeature=undefined;showMobileMap();$('#route-card').hidden=false;$('#route-card').innerHTML=`<button id="close-route" aria-label="Close selected place">${icon('close')}</button><div class="eyebrow">Lodge</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.kind)}${p.access?' · '+escapeHtml(p.access)+' access':''}</p><div class="place-links"><a href="${mapsLink(terrainData!,p.point)}" target="_blank" rel="noopener">Google Maps ↗</a><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Map source ↗</a></div>`;$('#close-route').onclick=()=>{$('#route-card').hidden=true;atlas?.home();};});
for(const el of document.querySelectorAll<HTMLButtonElement>('[data-explorer]'))el.onclick=()=>{explorer=el.dataset.explorer as typeof explorer;featureQuery='';$<HTMLInputElement>('#feature-search').value='';$<HTMLInputElement>('#feature-search').placeholder=explorer==='stops'?'Search lodges':explorer==='lifts'?'Search lifts':'Search trails';renderList();};
$('#feature-search').oninput=e=>{featureQuery=(e.target as HTMLInputElement).value;renderList();};
for(const el of document.querySelectorAll<HTMLButtonElement>('[data-layer]'))el.onclick=()=>{const show=el.getAttribute('aria-pressed')!=='true';el.setAttribute('aria-pressed',String(show));el.querySelector('.layer-check')!.textContent=show?'✓':'−';atlas?.toggleLayer(el.dataset.layer as 'trails'|'lifts'|'labels'|'roads'|'places',show);};
function setPerspective(overhead:boolean){if(atlas){atlas.topDown=overhead;atlas.home();}$('#panorama-view').classList.toggle('active',!overhead);$('#overhead-view').classList.toggle('active',overhead);$('#panorama-view').setAttribute('aria-pressed',String(!overhead));$('#overhead-view').setAttribute('aria-pressed',String(overhead));}
for(const mode of ['pan','rotate'] as const)$('#'+mode+'-mode').onclick=()=>{atlas?.setInteractionMode(mode);$('.touch-hint').textContent=mode==='pan'?'Drag to pan · Two fingers: pan, pinch & twist':'Drag to rotate · Two fingers: pan, pinch & twist';for(const value of ['pan','rotate']){const button=$('#'+value+'-mode');button.classList.toggle('active',value===mode);button.setAttribute('aria-pressed',String(value===mode));}};
$('#panorama-view').onclick=()=>setPerspective(false);$('#overhead-view').onclick=()=>setPerspective(true);
function renderRiderSettings(){
 $<HTMLInputElement>('#wildlife-visible').checked=wildlifeVisible;const ecology=atlas?.ecology;$('#ecology-description').textContent=ecology?`${ecology.name} · ${ecology.animalName}`:'Loading local nature…';
 for(const kind of ['skier','snowboarder'] as const){
  const visible=riderSettings[kind==='skier'?'skiers':'snowboarders'];$<HTMLInputElement>('#'+kind+'-visible').checked=visible;
  for(const property of ['size','speed'] as const){const key=(kind+(property==='size'?'Size':'Speed')) as keyof RiderSettings;const value=riderSettings[key] as number;const input=$<HTMLInputElement>('#'+kind+'-'+property);input.value=String(value);input.style.setProperty('--progress',`${(value-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`);input.disabled=!visible;const label=property==='speed'&&value===0?'Still':value.toFixed(2).replace(/0$/,'')+'×';input.setAttribute('aria-valuetext',label);$('#'+kind+'-'+property+'-value').textContent=label;}
 }
 const skiOnly=['alta','deer-valley'].includes(selected);$<HTMLInputElement>('#snowboarder-visible').disabled=skiOnly;
 if(skiOnly)for(const property of ['size','speed'])$<HTMLInputElement>('#snowboarder-'+property).disabled=true;
 $('#rider-settings-note').textContent=skiOnly?'Skiers only.':'0× speed pauses riders.';
}
function applyRiderSettings(){if(atlas)atlas.riderSettings={...riderSettings};try{localStorage.setItem(riderSettingsKey,JSON.stringify(riderSettings));}catch{}renderRiderSettings();}
function toggleSettings(open:boolean){$('#rider-settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));if(open){toggleGuide(false);$('#weather-timeline').hidden=true;$('#weather-drawer').setAttribute('aria-expanded','false');$('#weather-drawer span').textContent='＋';renderRiderSettings();$('#close-settings').focus();}}
$('#settings-toggle').onclick=()=>toggleSettings($('#rider-settings').hidden);
$('#close-settings').onclick=()=>{toggleSettings(false);$('#settings-toggle').focus();};
for(const input of document.querySelectorAll<HTMLInputElement>('[data-rider-setting]'))input.oninput=()=>{riderSettings=normalizeRiderSettings({...riderSettings,[input.dataset.riderSetting!]:input.type==='checkbox'?input.checked:Number(input.value)});applyRiderSettings();};
$('#wildlife-visible').onchange=()=>{wildlifeVisible=$<HTMLInputElement>('#wildlife-visible').checked;if(atlas)atlas.showWildlife=wildlifeVisible;try{localStorage.setItem('ski-map-explorer-3000:wildlife',String(wildlifeVisible));}catch{}};
$('#reset-rider-settings').onclick=()=>{riderSettings={...defaultRiderSettings};wildlifeVisible=true;if(atlas)atlas.showWildlife=true;try{localStorage.removeItem('ski-map-explorer-3000:wildlife');}catch{}applyRiderSettings();notify('Rider settings reset.');};
navigate();
if(atlas?.reducedMotion){$('#motion-toggle').innerHTML=icon('play');$('#motion-toggle').setAttribute('aria-label','Resume mountain animation');}

window.addEventListener('motion-preference-changed',()=>{if(!atlas)return;const stopped=atlas.paused||(atlas.reducedMotion&&!atlas.motionOverride);$('#motion-toggle').innerHTML=icon(stopped?'play':'pause');$('#motion-toggle').setAttribute('aria-label',stopped?'Resume mountain animation':'Pause mountain animation');});
