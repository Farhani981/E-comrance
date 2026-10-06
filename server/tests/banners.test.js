import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBanner } from '../utils/bannerValidation.js';
const valid = {title:'A considered wardrobe',image:'https://example.com/banner.webp',link:'/shop?category=Eastern+Wear',secondaryLink:'/#categories',badge:'New season'};
test('banner payload retains editable content and supports partial visibility updates',()=>{
  assert.equal(validateBanner(valid).badge,'New season');
  assert.deepEqual(validateBanner({isActive:false},true),{isActive:false});
  assert.equal(validateBanner({...valid,secondaryButtonText:''}).secondaryButtonText,'');
});
test('unsafe destinations and malformed or oversized content are rejected',()=>{
  for (const link of ['javascript:alert(1)','//example.com','/\\example.com','https://example.com','/bad\npath']) assert.throws(()=>validateBanner({...valid,link}));
  assert.throws(()=>validateBanner({...valid,title:' '}));
  assert.throws(()=>validateBanner({...valid,image:'data:text/html;base64,AAAA'}));
  assert.throws(()=>validateBanner({...valid,badge:'x'.repeat(81)}));
  assert.throws(()=>validateBanner({isActive:'false'},true));
  assert.throws(()=>validateBanner({position:-1},true));
});
