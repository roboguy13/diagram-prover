import { PartialSemigroup } from "./PartialSemigroup";
// import { Cell } from "./Propagator";

// export type Region = {
//   // top-left corner
//   x: number
//   y: number

//   width: number
//   height: number
// }

// export type RegionCell = Cell<Region>

// export function partialSemigroupRegion(): PartialSemigroup<Region> {
//   return {
//     combine: (a, b) => {
//       let c = intersectRegion(a, b)
//       if (c.width <= 0 || c.height <= 0) {
//         return null
//       } else {
//         return c
//       }
//     }
//   }
// }

// export function intersectRegion(region1: Region, region2: Region): Region {
//   return {
//     x: Math.max(region1.x, region2.x),
//     y: Math.max(region1.y, region2.y),
//     width: Math.min(region1.x + region1.width, region2.x + region2.width) - Math.max(region1.x, region2.x),
//     height: Math.min(region1.y + region1.height, region2.y + region2.height) - Math.max(region1.y, region2.y),
//   }
// }

// // The left rectangle consisting of every point of region1 that is not contained in region2
// export function subtractRegionLeft(region1: Region, region2: Region): Region {
//   return {
//     x: region1.x,
//     y: Math.max(region1.y, region2.y),
//     width: Math.max(region1.x, region2.x) - region1.x,
//     height: Math.min(region1.y + region1.height, region2.y + region2.height) - Math.max(region1.y, region2.y),
//   }
// }

// // The right rectangle consisting of every point of region1 that is not contained in region2
// export function subtractRegionRight(region1: Region, region2: Region): Region {
//   return {
//     x: Math.min(region1.x + region1.width, region2.x + region2.width),
//     y: Math.max(region1.y, region2.y),
//     width: region1.x + region1.width - Math.min(region1.x + region1.width, region2.x + region2.width),
//     height: Math.min(region1.y + region1.height, region2.y + region2.height) - Math.max(region1.y, region2.y),
//   }
// }
