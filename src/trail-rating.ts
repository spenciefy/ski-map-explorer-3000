import {difficultyNames,featureLength,featureTitle,trailColor,type MapFeature} from './geography.ts';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function trailRating(resort:string,difficulty:string){
 const color='#'+trailColor(resort,difficulty).toString(16).padStart(6,'0');
 const shape=difficulty==='expert'?'double-diamond':difficulty==='advanced'?'diamond':difficulty==='intermediate'?(color==='#c34843'?'circle':'square'):['easy','novice'].includes(difficulty)?(color==='#317aad'?'square':'circle'):'unrated';
 return {shape,color,label:difficultyNames[difficulty]||'Unrated'};
}
export function ratingMarkup(resort:string,f:MapFeature){
 const r=trailRating(resort,f.difficulty);
 return `<span class="trail-rating"><span class="rating-mark ${r.shape}" style="--rating-color:${r.color}" aria-hidden="true"><i></i>${r.shape==='double-diamond'?'<i></i>':''}</span><span>${r.label}</span></span>`;
}
export function trailHoverMarkup(resort:string,f:MapFeature){
 const length=featureLength(f),distance=length>=1000?`${(length/1000).toFixed(1)} km`:`${Math.round(length/10)*10} m`;
 return `<strong class="trail-hover-name">${escape(featureTitle(f))}</strong><div class="trail-hover-meta">${f.kind==='trail'?ratingMarkup(resort,f):'<span>Lift</span>'}${f.area?'<span>Trail area</span>':`<span>≈ ${distance}${f.kind==='trail'?' · mapped segment':''}</span>`}</div>`;
}
