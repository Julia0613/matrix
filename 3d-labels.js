import {Vector3} from 'three';

const corner=new Vector3(),center=new Vector3();

// Project the same fixed object bounds every frame. The gap is in screen pixels,
// so orbiting and zooming cannot lift a caption into another row.
export function labelAnchor(bounds,camera,width,height,gap=14){
 if(!bounds||bounds.isEmpty())return null;
 bounds.getCenter(center).project(camera);
 if(center.z < -1||center.z > 1)return null;
 let left=Infinity,right=-Infinity,top=Infinity;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  corner.set(x,y,z).project(camera);
  if(corner.z < -1||corner.z > 1)return null;
  left=Math.min(left,corner.x);right=Math.max(right,corner.x);top=Math.min(top,(1-corner.y)*height/2);
 }
 const x=(left+right+2)*width/4,y=top-gap;
 return x>=0&&x<=width&&y>=0&&y<=height?{x,y}:null;
}
