import test from 'node:test';
import assert from 'node:assert/strict';
import {trailRating,trailHoverMarkup} from '../src/trail-rating.ts';
test('trail badges follow North American and Japanese ratings',()=>{
 assert.equal(trailRating('jackson','easy').shape,'circle');
 assert.equal(trailRating('jackson','intermediate').shape,'square');
 assert.equal(trailRating('jackson','advanced').shape,'diamond');
 assert.equal(trailRating('jackson','expert').shape,'double-diamond');
 assert.equal(trailRating('niseko','intermediate').color,'#c34843');
 assert.equal(trailRating('niseko','intermediate').shape,'circle');
 assert.equal(trailRating('jackson','unknown').shape,'unrated');
});
test('hover cards safely render names and distinguish trail area from segment distance',()=>{
 const f={id:1,kind:'trail',name:'<img src=x>',difficulty:'expert',type:'downhill',area:false,access:'',points:[[0,0],[300,400]]};
 const html=trailHoverMarkup('jackson',f);
 assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('500 m'));assert(html.includes('double-diamond'));
 assert(trailHoverMarkup('jackson',{...f,area:true}).includes('Trail area'));
 assert(!trailHoverMarkup('jackson',{...f,area:true}).includes('500 m'));
});
