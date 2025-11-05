// ==================================================================================
// Script 3.1: Hybrid Classification - Classifier 1 (Phenology-Enhanced)
// ==================================================================================
// Purpose:
// Trains the first RF classifier using the 'Key Phenological-Stage Feature Set'
//            (as described in Section D). This produces the high-accuracy,
//            but potentially gappy, map (Result 1).
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SCRIPT PARAMETERS AND SETUP
// ----------------------------------------------------------------------------------

// --- AOIs ---
var processingAndEvalAoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(processingAndEvalAoi, 9);
Map.addLayer(processingAndEvalAoi, {color: '009999'}, 'Processing & Evaluation AOI', true, 0.5);
var featureStackAssetId = 'projects/user/assets/FeatureStack_Landsat_2024_Enhanced_Masked'; 
var trainingSamplesAssetId = 'projects/user/assets/2024_landcover_polygons';

var classProperty = 'landcover';
var numberOfClasses = 13;
var seed = 0;

// Palette for 13 classes (0-12)
var palette = [
  '0000FF', // 0: River
  '00FFFF', // 1: Lake
  'A9A9A9', // 2: Mudflat
  'FFFF00', // 3: Paddy_Field
  'FFC0CB', // 4: Aquaculture_Pond
  '800080', // 5: Reservoir
  'FF0000', // 6: Built-up_Land
  'FFA500', // 7: Dry_Cropland
  '006400', // 8: Forest
  '9ACD32', // 9: Grassland
  'D2B48C', // 10: Bare_Land
  '90EE90', // 11: Herbaceous_Wetland
  '556B2F'  // 12: Woody_Wetland
];

print('Loading Key Phenological-Stage Feature Set (Asset): ' + featureStackAssetId);
var featureStack2024;
try {
  featureStack2024 = ee.Image(featureStackAssetId)
                      .clipToCollection(processingAndEvalAoi);
  print('Feature Stack Loaded and Clipped to AOI. Bands:', featureStack2024.bandNames());
} catch (error) {
  print('Error loading Feature Stack Asset! Check ID and permissions.', error);
  throw new Error('Failed to load Feature Stack Asset.');
}
var bandsForTraining = featureStack2024.bandNames();

print('Loading Training Samples Asset: ' + trainingSamplesAssetId);
var trainingSamplesAllRaw;
try {
  trainingSamplesAllRaw = ee.FeatureCollection(trainingSamplesAssetId);
  print('Training Samples Loaded. Total polygons from asset:', trainingSamplesAllRaw.size());
} catch (error) {
  print('Error loading Training Samples Asset! Check ID and permissions.', error);
  throw new Error('Failed to load Training Samples Asset.');
}

// ----------------------------------------------------------------------------------
// 2. PREPARE TRAINING DATA (Stratified Random Point Sampling)
// ----------------------------------------------------------------------------------
print('Preparing training data (stratified random sampling)...');
var trainingPolygonsInAoi = trainingSamplesAllRaw.filterBounds(processingAndEvalAoi);
print('Number of training polygons intersecting the AOI:', trainingPolygonsInAoi.size());

// Per Section 3.3, sample 5,000 points per class
var pointsPerClassTarget = 5000; 
var allSampledPointsList = [];

for (var i = 0; i < numberOfClasses; i++) {
  var classValue = i;
  var polygonsOfClassInAoi = trainingPolygonsInAoi.filter(ee.Filter.eq(classProperty, classValue));

  if (polygonsOfClassInAoi.size().getInfo() > 0) {
    var classRegion = polygonsOfClassInAoi.geometry().dissolve(ee.ErrorMargin(1));
    if (classRegion.coordinates().size().getInfo() > 0) {
        var points = ee.FeatureCollection.randomPoints({
          region: classRegion,
          points: pointsPerClassTarget,
          seed: seed + classValue
        });
        var pointsWithLabel = points.map(function(pointFeature){
          return pointFeature.set(classProperty, classValue);
        });
        allSampledPointsList.push(pointsWithLabel);
        print('Class ' + classValue + ': Sampled ' + pointsWithLabel.size().getInfo() + ' points from AOI.');
    } else {
        print('Warning: Class ' + classValue + ' polygons in AOI resulted in an empty geometry after dissolve.');
    }
  } else {
    print('Warning: No training polygons found for class value: ' + classValue + ' within the AOI.');
  }
}

if (allSampledPointsList.length === 0) {
  print('Error: No training points were generated overall. Check training polygons overlap and class labels.');
  throw new Error('No training points generated.');
}

var sampledPoints = ee.FeatureCollection(allSampledPointsList).flatten();
print('Total sampled points from all classes within AOI:', sampledPoints.size());

var trainingDataForClassifier = featureStack2024.select(bandsForTraining).sampleRegions({
  collection: sampledPoints,
  properties: [classProperty],
  scale: 30,
  tileScale: 16
});
print('Training data prepared. Number of pixels for classifier:', trainingDataForClassifier.size());

trainingDataForClassifier.size().evaluate(function(size, failure) {
  if (failure || size === 0) {
    print('Error: No training data pixels extracted. The sampled points may fall in masked areas of the feature stack.');
    throw new Error('No training data pixels extracted.');
  }
});

// ----------------------------------------------------------------------------------
// 3. SPLIT TRAINING AND VALIDATION DATA
// ----------------------------------------------------------------------------------
print('Splitting data into training (70%) and validation (30%) sets...');
trainingDataForClassifier = trainingDataForClassifier.randomColumn('random', seed);
var trainingSplit = 0.7;
var trainSet = trainingDataForClassifier.filter(ee.Filter.lt('random', trainingSplit));
var validationSet = trainingDataForClassifier.filter(ee.Filter.gte('random', trainingSplit));
print('Training set size:', trainSet.size());
print('Validation set size (within AOI):', validationSet.size());

// ----------------------------------------------------------------------------------
// 4. TRAIN RANDOM FOREST CLASSIFIER (Classifier 1)
// ----------------------------------------------------------------------------------
print('Training Random Forest Classifier (Classifier 1)...');
var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 300,
  minLeafPopulation: 1,
  bagFraction: 0.5,
  seed: seed
}).train({
  features: trainSet,
  classProperty: classProperty,
  inputProperties: bandsForTraining
});
print('Classifier 1 trained.');

// ----------------------------------------------------------------------------------
// 5. CLASSIFY THE IMAGE
// ----------------------------------------------------------------------------------
print('Classifying the Key Phenological-Stage feature stack (Result 1)...');
var classifiedImage = featureStack2024.select(bandsForTraining)
                                     .classify(classifier)
                                     .rename('classification');

// This map is "Result 1" - high accuracy, but potentially gappy
Map.addLayer(classifiedImage, {min: 0, max: numberOfClasses - 1, palette: palette}, 'Raw Classification (Result 1 - Gappy)', true);

// ----------------------------------------------------------------------------------
// 8. EXPORT CLASSIFIED IMAGE (Result 1)
// ----------------------------------------------------------------------------------
// Export the raw, unsmoothed classification (Result 1).
var imageToExport = classifiedImage; 
var exportDescription = 'LULC_Result1_Enhanced_Masked_RAW'; // (Internal asset name)
var exportAssetId = 'projects/user/assets/LULC_Result1_Enhanced_Masked_RAW'; // (Internal asset name)

print('>>> Preparing to export Raw Classification (Result 1) to Asset... <<<');
print('>>> Asset ID: ' + exportAssetId + ' <<<');
print('>>> Please check the "Tasks" tab and click "RUN" to start the export. <<<');

Export.image.toAsset({
  image: imageToExport.select('classification'), // Export the raw 'classification' band
  description: exportDescription,
  assetId: exportAssetId,
  region: processingAndEvalAoi.geometry(),
  scale: 30,
  maxPixels: 1e13,
  pyramidingPolicy: {'.default': 'mode'}
});

// ==================================================================================
// END OF SCRIPT 3.1
// ==================================================================================
