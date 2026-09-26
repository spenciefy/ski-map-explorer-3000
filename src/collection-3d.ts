import { clusterPoints } from './globe-clusters';
import { AtlasScene } from './scene';
import { addTouchRotation } from './touch-rotation';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resorts, type Resort } from './data';

export class TerrainPreview {
 private tiles=new Map<HTMLElement,RotatingTerrainPreview>();
 private visible=new Set<HTMLElement>();private enabled=true;
 private observer:IntersectionObserver;
 constructor(grid:HTMLElement){
  this.observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const host=entry.target as HTMLElement;if(entry.isIntersecting)this.visible.add(host);else this.visible.delete(host);}
   this.sync();
  },{threshold:.05});
  for(const host of grid.querySelectorAll<HTMLElement>('.mountain-preview')){
   this.tiles.set(host,new RotatingTerrainPreview(host.parentElement!));this.observer.observe(host);
  }
  document.addEventListener('visibilitychange',()=>this.sync());
 }
 setVisible(enabled:boolean){this.enabled=enabled;this.sync();}
 private sync(){for(const[host,preview]of this.tiles){if(this.enabled&&!document.hidden&&this.visible.has(host)&&host.getClientRects().length){void preview.activate(host,host.closest('a')!.getAttribute('href')!.slice(1));}else preview.hide();}}
 hide(){for(const preview of this.tiles.values())preview.hide();}
}

class RotatingTerrainPreview {
 private atlas?:AtlasScene;private stage=document.createElement('div');private labels=document.createElement('div');
 private host?:HTMLElement;private request=0;private timer?:ReturnType<typeof setTimeout>;private ready=false;
 private start?:{x:number;y:number};private dragged=false;private loading?:Promise<void>;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(grid:HTMLElement){
  this.stage.className='preview-stage';this.stage.setAttribute('aria-hidden','true');
  this.reduced.addEventListener('change',()=>{if(this.atlas)this.atlas.controls.autoRotate=!this.reduced.matches&&!this.start;});
  grid.querySelectorAll<HTMLElement>('.mountain-preview').forEach(host=>{
   const id=host.closest('a')!.getAttribute('href')!.slice(1);
   host.setAttribute('aria-label','Drag to rotate '+resorts.find(r=>r.id===id)!.name);
   host.closest('a')!.addEventListener('keydown',async e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();await this.activate(host,id);if(this.host===host)this.rotate(e.key==='ArrowLeft'?.15:e.key==='ArrowRight'?-.15:0,e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0);});
   host.addEventListener('pointerdown',e=>{if(e.button!==0)return;clearTimeout(this.timer);this.start={x:e.clientX,y:e.clientY};this.dragged=false;if(this.atlas)this.atlas.controls.autoRotate=false;host.setPointerCapture(e.pointerId);});
   host.addEventListener('pointermove',e=>{if(!this.start)return;const dx=e.clientX-this.start.x,dy=e.clientY-this.start.y;if(!this.dragged&&Math.hypot(dx,dy)<=6)return;this.dragged=true;this.start={x:e.clientX,y:e.clientY};void this.activate(host,id).then(()=>{if(this.host===host)this.rotate(-dx*.008,dy*.006);});});
   const end=()=>{this.start=undefined;if(this.atlas)this.atlas.controls.autoRotate=!this.reduced.matches;};
   host.addEventListener('pointerup',end);host.addEventListener('pointercancel',()=>{end();this.dragged=true;this.hide();});
   host.addEventListener('click',e=>{if(this.dragged){e.preventDefault();e.stopPropagation();this.dragged=false;}},true);
  });
 }
 activate(host:HTMLElement,id:string):Promise<void>{
  if(this.host===host)return this.loading??Promise.resolve();
  const gesture=this.start;this.hide();this.start=gesture;this.host=host;const request=++this.request;host.append(this.stage);
  this.loading=this.load(host,id,request);return this.loading;
 }
 private async load(host:HTMLElement,id:string,request:number){
  try{
   if(!this.atlas){this.atlas=new AtlasScene(this.stage,this.labels,()=>{},true);this.atlas.paused=true;this.atlas.showLabels=false;this.atlas.showPlaces=false;this.atlas.showSnow=false;this.atlas.controls.enableDamping=false;this.atlas.renderer.setPixelRatio(1);this.atlas.renderer.domElement.tabIndex=-1;}
   const a=this.atlas;a.suspended=true;a.controls.autoRotate=false;a.selected=id;
   await a.load(resorts.find(r=>r.id===id)!);
   if(request!==this.request||!a.data)return;
   // Match the camera and detailed geometry used to render the gallery thumbnails.
   const direction=a.camera.position.clone().sub(a.controls.target).normalize();
   a.controls.target.set(0,(a.maxElevation-a.minElevation)*a.scale*.3,0);
   a.camera.position.copy(a.controls.target).addScaledVector(direction,430);
   a.targetCamera=null;a.targetLook=null;a.resize();a.controls.update();
   a.renderer.render(a.scene,a.camera);this.ready=true;host.classList.add('preview-active');
   a.controls.autoRotateSpeed=.35;a.controls.autoRotate=!this.reduced.matches&&!this.start;a.suspended=false;
  }catch{if(request===this.request)this.hide();}
 }
 private rotate(yaw:number,pitch:number){if(!this.atlas||!this.ready)return;const a=this.atlas,s=new THREE.Spherical().setFromVector3(a.camera.position.clone().sub(a.controls.target));s.theta+=yaw;s.phi=THREE.MathUtils.clamp(s.phi+pitch,.2,1.4);a.camera.position.copy(a.controls.target).add(new THREE.Vector3().setFromSpherical(s));a.controls.update();}
 hide(){clearTimeout(this.timer);this.start=undefined;this.request++;this.ready=false;this.host?.classList.remove('preview-active');this.host=undefined;this.stage.remove();if(this.atlas){this.atlas.disposePreview();this.atlas=undefined;}this.stage.replaceChildren();this.loading=undefined;}

}

export function globePosition(lat:number,lon:number,r=1){const a=THREE.MathUtils.degToRad(lat),b=THREE.MathUtils.degToRad(lon);return new THREE.Vector3(Math.cos(a)*Math.cos(b)*r,Math.sin(a)*r,-Math.cos(a)*Math.sin(b)*r);}
export class MountainGlobe {
 private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(38,1,.01,20);private controls:OrbitControls;
 private markerLayer=document.createElement('div');private markerButtons=new Map<string,HTMLButtonElement>();private markerState='';private enabled=false;private ids=new Set(resorts.map(r=>r.id));
 constructor(private host:HTMLElement,private select:(resort:Resort)=>void,private selectGroup:(resorts:Resort[])=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Mountain globe. Drag or twist two fingers to rotate; scroll or pinch to zoom. Use the mountain list to select with a keyboard.');this.renderer.domElement.setAttribute('role','img');
  this.camera.position.copy(globePosition(43,-113,1.5));this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enablePan=false;this.controls.minDistance=1.08;this.controls.maxDistance=4.5;this.controls.enableDamping=true;
  addTouchRotation(this.renderer.domElement,angle=>{const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();});
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xb5c1b7,2));const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshBasicMaterial({color:0xe1e5db}));this.scene.add(sphere);void this.land(sphere);
  this.markerLayer.className='globe-marker-layer';host.append(this.markerLayer);
  new ResizeObserver(()=>this.resize()).observe(host);this.renderer.setAnimationLoop(()=>{if(!this.enabled||document.hidden)return;this.controls.update();this.renderer.render(this.scene,this.camera);this.updateMarkers();});

 }
 private async land(sphere:THREE.Mesh){try{const res=await fetch('/globe-land.geojson');const data=await res.json();const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const c=canvas.getContext('2d')!;c.fillStyle='#ccd9d6';c.fillRect(0,0,2048,1024);c.fillStyle='#edf0e4';for(const feature of data.features){const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;for(const polygon of polygons){c.beginPath();for(const ring of polygon){ring.forEach(([lon,lat]:number[],i:number)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.closePath();}c.fill('evenodd');c.strokeStyle='#9aaea4';c.lineWidth=.8;c.stroke();}}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;(sphere.material as THREE.MeshBasicMaterial).map=texture;(sphere.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);(sphere.material as THREE.Material).needsUpdate=true;}catch{this.host.dataset.mapError='Coastlines unavailable';}}
 setVisible(show:boolean){this.enabled=show;this.resize();}filter(ids:Set<string>){this.ids=ids;this.markerState='';}
 focus(resort:Resort){this.camera.position.copy(globePosition(resort.lat,resort.lon,2));this.controls.target.set(0,0,0);this.controls.update();this.select(resort);}
 zoom(factor:number){this.camera.position.setLength(THREE.MathUtils.clamp(this.camera.position.length()*factor,1.08,4.5));this.controls.update();}
 region(lat:number,lon:number,distance=2){this.camera.position.copy(globePosition(lat,lon,distance));this.controls.target.set(0,0,0);this.controls.update();}
 private updateMarkers(){
  const w=this.host.clientWidth,h=this.host.clientHeight;
  const state=[...this.camera.position.toArray(),...this.camera.quaternion.toArray(),w,h].join(',');if(state===this.markerState)return;this.markerState=state;
  const points=resorts.filter(r=>this.ids.has(r.id)).flatMap(resort=>{const normal=globePosition(resort.lat,resort.lon);if(normal.dot(this.camera.position.clone().sub(normal))<=0)return [];const p=normal.clone().multiplyScalar(1.006).project(this.camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;return p.z<1&&x>22&&x<w-22&&y>22&&y<h-22?[{id:resort.id,resort,x,y}]:[];});
  const compact=w<600;const groups=clusterPoints(points,compact?116:152,compact?110:130),active=new Set<string>();
  for(const group of groups){const members=group.points.map(p=>p.resort),key=members.map(r=>r.id).sort().join('|');active.add(key);let button=this.markerButtons.get(key);
   if(!button){button=document.createElement('button');button.className='globe-marker';const artwork=document.createElement('span');artwork.className='globe-marker-art';for(const resort of members.slice(0,3)){const image=document.createElement('img');image.src='/previews/'+resort.id+'.png';image.alt='';image.draggable=false;image.decoding='async';artwork.append(image);}const caption=document.createElement('span');caption.className='globe-marker-name';caption.textContent=members.length===1?members[0].name:members.every(r=>r.area===members[0].area)?members[0].area:members.every(r=>r.country===members[0].country)?members[0].country:'North America';const count=document.createElement('span');count.className='globe-marker-count';count.textContent=members.length===1?members[0].area:members.length+' mountains';button.append(artwork,caption,count);this.markerButtons.set(key,button);this.markerLayer.append(button);button.onclick=()=>{if(members.length===1){this.select(members[0]);return;}const normal=members.reduce((sum,r)=>sum.add(globePosition(r.lat,r.lon)),new THREE.Vector3()).normalize();this.camera.position.copy(normal.multiplyScalar(1+Math.max(.08,(this.camera.position.length()-1)*.55)));this.controls.update();this.selectGroup(members);};}
   button.classList.toggle('is-cluster',members.length>1);button.setAttribute('aria-label',members.length===1?'Select '+members[0].name:'Explore '+members.length+' mountains: '+members.map(r=>r.name).join(', '));button.style.left=group.x+'px';button.style.top=group.y+'px';
  }
  for(const [key,button] of this.markerButtons)if(!active.has(key)){button.remove();this.markerButtons.delete(key);}
 }
 private resize(){if(!this.enabled)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
}
