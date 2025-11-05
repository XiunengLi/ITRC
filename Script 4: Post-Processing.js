// ==================================================================================
// Script 4: Post-Processing Pipeline
// (Implements Section E of the paper)
// ==================================================================================
// Purpose: 
//         Refines the "Raw Classification Map" (from Script 3.2) by correcting
//         logical inconsistencies and enhancing spatial integrity, producing
//         the final "Refined LULC Map".
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SETUP: LOAD DATA AND DEFINE PARAMETERS
// ----------------------------------------------------------------------------------

var aoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'A. Processing & Evaluation AOI', true);

var initialClassificationId = 'projects/user/assets/LULC_2024_Final_Combined_RAW';
// This stack provides Slope and TWI (from Script 1)
var featureStackForTopoId = 'projects/user/assets/FeatureStack_Landsat_2024_AnnualRobust_NoGaps';

print('Loading Raw Classification Map: ' + initialClassificationId);
var initialClassification = ee.Image(initialClassificationId).clip(aoi.geometry()).select(0).rename('classification');
Map.addLayer(initialClassification, {min: 0, max: 12, palette: 'black'}, 'B. Input (Raw Classification Map)', false);

print('Loading Topographic Features: ' + featureStackForTopoId);
var topoFeatures = ee.Image(featureStackForTopoId).select(['Slope', 'TWI']);

var riverClassValue = 0;
var lakeClassValue = 1;
var reservoirClassValue = 5;
var pondAquacultureClassValue = 4;
var woodySwampClassValue = 12; 
var uplandForestClassValue = 8; 

var palette = [ // 13-color palette for classes 0-12
  '0000FF', '00FFFF', '663300', 'FFFF00', 'FFC0CB', '800080',
  'FF0000', 'FFA500', '006400', '9ACD32', 'D2B48C', '90EE90', '556B2F'
];

// --- Post-Processing Parameters ---
// *** IMPORTANT NOTE ***
// The parameter values below are highly optimized for the study area (Yangtze
// River Delta) and were derived from the sensitivity analysis (Section G).
// Users MUST calibrate and optimize these parameters for their own study area 
// and classification scheme. These values are provided for reference only.

var protectionMaskErosionRadius = 1;
var largeWaterbodyAreaThreshold = 2000; 
var openingRadius_PondToRiver = 0.5;  
var riverConnectingRadius = 2;       
var largeWaterBufferDistanceMeters = 2;  
var swampSlopeThreshold = 10;            
var swampTwiThreshold = 8;               
var swampWaterDistanceThreshold = 300; 
var minimumPatchSize = 8;                
var finalSmoothingRadius = 1;            

// ==================================================================================
// 2. POST-PROCESSING PIPELINE ( Section 3.5)
// ==================================================================================
var currentClassification = initialClassification;

// --- (a) Protection Mask Generation ---
print('\n--- (a) Generating Non-Water Protection Mask ---');
var waterClasses = [riverClassValue, lakeClassValue, reservoirClassValue, pondAquacultureClassValue];
var nonWaterMask = currentClassification.remap(waterClasses, ee.List.repeat(0, waterClasses.length), 1).unmask(1);
var protectionMask = nonWaterMask.focal_min(protectionMaskErosionRadius);

// --- (b) Water Body Logical Corrections ---
print('\n--- (b) Performing Water Body Logical Corrections ---');

// (b1) Large Water Body Reclassification: Reclassify large "River" patches as "Lake"
var riverMask_S2_1 = currentClassification.eq(riverClassValue);
var riverPatchArea_S2_1 = riverMask_S2_1.connectedPixelCount({maxSize: 1024});
var largeRiverPatchesMask_S2_1 = riverPatchArea_S2_1.gte(largeWaterbodyAreaThreshold);
currentClassification = currentClassification.where(largeRiverPatchesMask_S2_1, lakeClassValue);

// (b2) Linear Pond Correction: Reclassify elongated "Ponds" as "River"
var ponds_S2_2 = currentClassification.eq(pondAquacultureClassValue);
var kernel_S2_2 = ee.Kernel.square({radius: openingRadius_PondToRiver});
var openedPonds_S2_2 = ponds_S2_2.focal_min({kernel: kernel_S2_2}).focal_max({kernel: kernel_S2_2});
var pondsToCorrectToRiver_S2_2 = ponds_S2_2.and(openedPonds_S2_2.not());
currentClassification = currentClassification.where(pondsToCorrectToRiver_S2_2, riverClassValue);

// (b3) River Network Connection (Constrained Closing)
var rivers_S2_3 = currentClassification.eq(riverClassValue);
var kernel_S2_3 = ee.Kernel.square({radius: riverConnectingRadius});
var dilatedRivers_S2_3 = rivers_S2_3.focal_max({kernel: kernel_S2_3});
var constrainedDilatedRivers = dilatedRivers_S2_3.and(protectionMask.not());
var connectedRivers_S2_3 = constrainedDilatedRivers.focal_min({kernel: kernel_S2_3});
currentClassification = currentClassification.where(connectedRivers_S2_3, riverClassValue);

// (b4) Water Body Edge Refinement: Reassign "River" pixels near "Lakes"
var rivers_S2_4 = currentClassification.eq(riverClassValue);
var largeWaterbodies_S2_4 = currentClassification.eq(lakeClassValue).or(currentClassification.eq(reservoirClassValue));
var coreLargeWater_S2_4 = largeWaterbodies_S2_4.focal_min({radius: 1});
var distanceToLargeWater_S2_4 = coreLargeWater_S2_4.fastDistanceTransform(256, 'pixels').sqrt();
var largeWaterBufferMask_S2_4 = distanceToLargeWater_S2_4.lte(largeWaterBufferDistanceMeters);
var riversOnEdge_S2_4 = rivers_S2_4.and(largeWaterBufferMask_S2_4);
currentClassification = currentClassification.where(riversOnEdge_S2_4, lakeClassValue);

// --- (c) Topographic Correction of Wetlands ---
print('\n--- (c) Correcting Topographic Unsuitable Wetlands ---');
var classificationAfterWaterFix = currentClassification;
var totalWaterMask = classificationAfterWaterFix.remap(waterClasses, ee.List.repeat(1, waterClasses.length), 0).unmask(0);
var distanceToAnyWater = totalWaterMask.fastDistanceTransform(1024, 'pixels').sqrt();
var woodySwampMask_S3 = classificationAfterWaterFix.eq(woodySwampClassValue);
var unsuitableTerrainMask_S3 = topoFeatures.select('Slope').gt(swampSlopeThreshold)
                               .or(topoFeatures.select('TWI').lt(swampTwiThreshold));
var farFromWaterMask_S3 = distanceToAnyWater.gt(swampWaterDistanceThreshold);
var swampToCorrectMask = woodySwampMask_S3.and(unsuitableTerrainMask_S3).and(farFromWaterMask_S3);
var classificationAfterSwampFix = classificationAfterWaterFix.where(swampToCorrectMask, uplandForestClassValue);

Map.addLayer(classificationAfterSwampFix, {min: 0, max: 12, palette: palette}, 'C. After Topo Correction', false);
print('Step (a)-(c) corrections applied.');

// --- (d) Small Patch Removal (Sieve) ---
print('\n--- (d) Removing small isolated patches (Sieve) ---');
var imageAfterCorrections = classificationAfterSwampFix;
var patchIdImage = imageAfterCorrections.connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 256
});
var patchSize = patchIdImage.select('labels')
  .connectedPixelCount({
    maxSize: 256, 
    eightConnected: true
  });
var smallPatchMask = patchSize.lt(minimumPatchSize);
var majorityFilteredForSieve = imageAfterCorrections.focal_mode({
  radius: 1, 
  kernelType: 'square',
  units: 'pixels'
});
var classificationAfterSieve = imageAfterCorrections.where(smallPatchMask, majorityFilteredForSieve);
Map.addLayer(classificationAfterSieve, {min: 0, max: 12, palette: palette}, 'D. After Sieve (MMU)', false);
print('Step (d) Sieve complete.');

// --- (e) Conditional Smoothing ---
print('\n--- (e) Applying Final Conditional Smoothing ---');
var finalCorrectedImage = classificationAfterSieve;
var kernel_S5 = ee.Kernel.square({radius: finalSmoothingRadius});
var globallySmoothed = finalCorrectedImage.focal_mode({kernel: kernel_S5, iterations: 1});
var noiseMask = finalCorrectedImage.neq(globallySmoothed);
var finalSmoothedClassification = finalCorrectedImage.where(noiseMask, globallySmoothed).rename('classification_final');
Map.addLayer(finalSmoothedClassification, {min: 0, max: 12, palette: palette}, 'E. Final Refined LULC Map', true);
print('Step (e) Conditional smoothing applied.');

// ----------------------------------------------------------------------------------
// 3. EXPORT THE "REFINED LULC MAP"
// ----------------------------------------------------------------------------------
print('\n>>> Preparing to export the FINAL "Refined LULC Map"... <<<');
Export.image.toDrive({
  image: finalSmoothedClassification.toByte(),
  description: 'LULC_2024_Final_FullPostProcess', // (Internal export name)
  folder: 'GEE_LULC_Exports_2024_Final',
  fileNamePrefix: 'LULC_2024_Final_FullPostProcess', // (Internal export name)
  region: aoi.geometry(),
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// ==================================================================================
// END OF SCRIPT 4
// ==================================================================================
