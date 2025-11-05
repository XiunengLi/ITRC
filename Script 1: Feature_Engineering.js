// ==================================================================================
// Script 1: Feature Engineering
// Calculate two feature sets (Annual Statistical & Key Phenological Sets),
// as described in Section B.
// ==================================================================================

// ----------------------------------------------------------------------------------
// 0. Setup: AOI, Time Range
// ----------------------------------------------------------------------------------
var aoi = ee.FeatureCollection('projects/user/assets/aoi');
var year = 2024;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = ee.Date.fromYMD(year, 12, 31);

Map.centerObject(aoi, 8);
Map.addLayer(aoi, {color: 'GREY', fillColor: '00000000'}, 'AOI Outline', true);

// ----------------------------------------------------------------------------------
// 1. Helper Functions
// ----------------------------------------------------------------------------------

function maskL89Sr(image) {
  var qa = image.select('QA_PIXEL');
  var cloudShadowSnowMask = (1 << 3) | (1 << 4) | (1 << 5);
  var dilatedCloud = (1 << 1);
  var mask = qa.bitwiseAnd(cloudShadowSnowMask).eq(0)
             .and(qa.bitwiseAnd(dilatedCloud).eq(0));
  var scale = 0.0000275;
  var offset = -0.2;
  return image.updateMask(mask)
      .select(
        ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
        ['Blue',  'Green', 'Red',   'NIR',   'SWIR1', 'SWIR2']
      )
      .multiply(scale).add(offset)
      .copyProperties(image, ['system:time_start', 'system:index']);
}


function addBaseIndices(image) {
  var blue = image.select('Blue');
  var green = image.select('Green');
  var red = image.select('Red');
  var nir = image.select('NIR');
  var swir1 = image.select('SWIR1');
  var swir2 = image.select('SWIR2');
  var ndvi = image.normalizedDifference(['NIR', 'Red']).rename('NDVI');
  var evi = image.expression('2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
      {'NIR': nir, 'RED': red, 'BLUE': blue}).rename('EVI');
  var savi = image.expression('(NIR - RED) * (1 + 0.5) / (NIR + RED + 0.5)',
      {'NIR': nir, 'RED': red}).rename('SAVI');
  // Per paper, rename NDWI_G_NIR to NDWI for conceptual clarity
  var ndwi = image.normalizedDifference(['Green', 'NIR']).rename('NDWI'); 
  // Per paper, rename MNDWI_G_SWIR1 to MNDWI
  var mndwi = image.normalizedDifference(['Green', 'SWIR1']).rename('MNDWI'); 
  var lswi = image.normalizedDifference(['NIR', 'SWIR1']).rename('LSWI');
  var ndbi = image.normalizedDifference(['SWIR1', 'NIR']).rename('NDBI');
  var aweish = image.expression('Blue + 2.5*Green - 1.5*(NIR + SWIR1) - 0.25*SWIR2',
      {'Blue': blue, 'Green': green, 'NIR': nir, 'SWIR1': swir1, 'SWIR2': swir2}).rename('AWEIsh');
  var aweinsh = image.expression('4*(Green - SWIR1) - (0.25*NIR + 2.75*SWIR2)',
      {'Green': green, 'SWIR1': swir1, 'NIR': nir, 'SWIR2': swir2}).rename('AWEInsh');
  // Update band list to match paper's terminology (NDWI, MNDWI)
  return image.addBands([ndvi, evi, savi, ndwi, mndwi, lswi, ndbi, aweish, aweinsh]);
}

// ----------------------------------------------------------------------------------
// 2. Load, Preprocess, and Calculate Annual Features
// ----------------------------------------------------------------------------------
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').filterBounds(aoi).filterDate(startDate, endDate).map(maskL89Sr);
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').filterBounds(aoi).filterDate(startDate, endDate).map(maskL89Sr);
var landsatAnnualCollection = l8.merge(l9).sort('system:time_start');
var landsatAnnualWithIndices = landsatAnnualCollection.map(addBaseIndices);
var annualCompositeWithIndices = landsatAnnualWithIndices.median();
var stdDevBands = ['NDVI', 'LSWI', 'MNDWI', 'NDWI']; 
var annualStdDevFeatures = landsatAnnualWithIndices.select(stdDevBands)
                             .reduce(ee.Reducer.stdDev())
                             .rename(stdDevBands.map(function(b){ return b + 'stdDev'; }));
var nirBand = annualCompositeWithIndices.select('NIR');
var nirUint8 = nirBand.unitScale(0, 0.5).multiply(255).toUint8();
var glcm = nirUint8.glcmTexture({size: 2});
// Rename features to match paper (dissimilarity, homogeneity)
var glcmFeatures = glcm.select(['NIR_contrast', 'NIR_diss', 'NIR_idm', 'NIR_ent'])
                       .rename(['GLCMcontrast', 'GLCMdissimilarity', 'GLCMhomogeneity', 'GLCMentropy']);
var mndwiThreshold = 0.0;
var waterMask = annualCompositeWithIndices.select('MNDWI').gt(mndwiThreshold); // Use MNDWI
var distanceToWater = waterMask.fastDistanceTransform({
  neighborhood: 256, // Max search radius in pixels
  metric: 'squared_euclidean'
}).sqrt();
var distanceFeature = distanceToWater.rename('distance_to_water');

// ----------------------------------------------------------------------------------
// 3. Define Phenological Stages and Calculate Stage-Specific Features
// ----------------------------------------------------------------------------------

//This needs to be set according to the actual planting time of rice in the study area.
var riceFloodingTransplantingStart = ee.Date.fromYMD(year, 5, 20); 
var riceFloodingTransplantingEnd = ee.Date.fromYMD(year, 6, 30);
var riceGrowingPeakStart = ee.Date.fromYMD(year, 7, 20);
var riceGrowingPeakEnd = ee.Date.fromYMD(year, 8, 30);

// --- a. Flooding & Transplanting Stage Indices ---
var landsatFlooding = landsatAnnualWithIndices.filterDate(riceFloodingTransplantingStart, riceFloodingTransplantingEnd);
var floodingComposite;
if (landsatFlooding.size().getInfo() > 0) {
  floodingComposite = landsatFlooding.median();
} else {
  floodingComposite = ee.Image().toDouble().updateMask(ee.Image(0)).addBands(ee.Image().rename('LSWI')).addBands(ee.Image().rename('NDVI')).addBands(ee.Image().rename('MNDWI'));
}
var lswiFlooding = floodingComposite.select('LSWI').rename('LSWIflood');
var ndviFlooding = floodingComposite.select('NDVI').rename('NDVIflood');
var mndwiFlooding = floodingComposite.select('MNDWI').rename('MNDWIflood');
// Match paper's name LSWIflood-NDVIflood
var lswi_minus_ndvi_Flooding = floodingComposite.expression('LSWI - NDVI', {'LSWI': floodingComposite.select('LSWI'), 'NDVI': floodingComposite.select('NDVI')}).rename('LSWIflood-NDVIflood');

// --- b. Peak Growing Stage Indices ---
var landsatGrowingPeak = landsatAnnualWithIndices.filterDate(riceGrowingPeakStart, riceGrowingPeakEnd);
var growingPeakComposite;
if (landsatGrowingPeak.size().getInfo() > 0) {
  growingPeakComposite = landsatGrowingPeak.median();
} else {
  growingPeakComposite = ee.Image().toDouble().updateMask(ee.Image(0)).addBands(ee.Image().rename('NDVI')).addBands(ee.Image().rename('EVI')).addBands(ee.Image().rename('LSWI'));
}
var ndviGrowingPeak = growingPeakComposite.select('NDVI').rename('NDVIpeak');
var eviGrowingPeak = growingPeakComposite.select('EVI').rename('EVIpeak');
var lswiGrowingPeak = growingPeakComposite.select('LSWI').rename('LSWIpeak');


// ----------------------------------------------------------------------------------
// 4. Load DEM Features
// ----------------------------------------------------------------------------------
var demCollection = ee.ImageCollection("COPERNICUS/DEM/GLO30");
var dem = demCollection.mosaic().setDefaultProjection(demCollection.first().projection());
var elevation = dem.select('DEM').rename('Elevation');
var slope_deg = ee.Terrain.slope(dem); 
var slope = slope_deg.rename('Slope'); 

// --- Standard TWI (Topographic Wetness Index) ---
var slope_rad = slope_deg.multiply(Math.PI / 180);
var flow_accumulation = ee.Terrain.flowAccumulation(dem);
var sca = flow_accumulation.multiply(ee.Image.pixelArea());
var twi = sca.divide(slope_rad.tan().add(0.001)).log().rename('TWI');

// Note: This is an alternative, non-standard formulation. 
// If the study area is large and exceeds computational limits, 
// this formula can be used as a computationally less expensive proxy.
// var twi = dem.expression('log( ( exp(19.2) * pow( slope + 0.001 , -1.3) ) )', {'slope': slope_deg}).rename('TWI');

var demFeatures = ee.Image.cat(elevation, slope, twi);

// ----------------------------------------------------------------------------------
// 5. Feature Stacking and Exporting Two Feature Sets
// (Terminology updated to match paper)
// ----------------------------------------------------------------------------------

// --- Set 1: Key Phenological-Stage Feature Set (N=34) ---
// (Corresponds to 'enhancedFeatureStack' variable)
// This set includes all 27 annual features + 7 phenology-specific features.
var enhancedFeatureStack = ee.Image.cat([
  annualCompositeWithIndices,
  demFeatures,
  glcmFeatures,
  annualStdDevFeatures,
  distanceFeature, 
  // Phenological features (7)
  lswiFlooding, ndviFlooding, mndwiFlooding, lswi_minus_ndvi_Flooding,
  ndviGrowingPeak, eviGrowingPeak, lswiGrowingPeak
]).float().clip(aoi);

var masterMask = enhancedFeatureStack.mask().reduce(ee.Reducer.min());
var enhancedFeatureStackMasked = enhancedFeatureStack.updateMask(masterMask);


// --- Set 2: Annual Time-Series Statistical Feature Set (N=27) ---
// (Corresponds to 'annualRobustFeatureStack' variable)
// This set is spatially complete and used for gap-filling.
var annualRobustFeatureStack = ee.Image.cat([
  annualCompositeWithIndices,
  demFeatures,
  glcmFeatures,
  annualStdDevFeatures,
  distanceFeature 
]).float().clip(aoi);

var selfMaskRobust = annualRobustFeatureStack.mask().reduce(ee.Reducer.min());
annualRobustFeatureStack = annualRobustFeatureStack.updateMask(selfMaskRobust);


// --- Export Tasks ---
// Export variable names updated to match paper terminology.

// Export for the "Key Phenological-Stage Feature Set"
var exportDesc1 = 'FeatureStack_2024_Enhanced_Masked';
var exportAssetId1 = 'projects/user/assets/FeatureStack_2024_Enhanced_Masked';
Export.image.toAsset({
  image: enhancedFeatureStackMasked,
  description: exportDesc1,
  assetId: exportAssetId1,
  region: aoi.geometry(),
  scale: 30,
  maxPixels: 1e13,
  pyramidingPolicy: {'.default': 'sample'}
});

// Export for the "Annual Time-Series Statistical Feature Set"
var exportDesc2 = 'FeatureStack_2024_AnnualRobust_NoGaps';
var exportAssetId2 = 'projects/user/assets/FeatureStack_2024_AnnualRobust_NoGaps';
Export.image.toAsset({
  image: annualRobustFeatureStack,
  description: exportDesc2,
  assetId: exportAssetId2,
  region: aoi.geometry(),
  scale: 30,
  maxPixels: 1e13,
  pyramidingPolicy: {'.default': 'sample'}
});
