const APIKEY = "AAPK682e8d97356f476f9d15d467e7ee861dRBMMknl70tkblVOMElgK1suI9ppIMr7gfDW8CxdHmSDL-0Y-pJfKPufckH9UGhCz";

document.addEventListener("DOMContentLoaded", function () {
    require([
        "esri/config",
        "esri/Map",
        "esri/views/SceneView",
        "esri/Graphic",
        "esri/layers/GraphicsLayer",
        "esri/geometry/Polyline",
        "esri/symbols/SimpleLineSymbol",
    ], function (esriConfig, Map, SceneView, Graphic, GraphicsLayer, Polyline, SimpleLineSymbol) {
        esriConfig.apiKey = APIKEY;

        var map = new Map({
            basemap: "arcgis-dark-gray",
        });

        var view = new SceneView({
            container: "viewDiv",
            map: map,
            camera: {
                position: {
                    x: 121.50,
                    y: 24.92,
                    z: 16000,
                },
                tilt: 40,
                heading: 15,
            },
        });

        var graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);

        var threshold = 800; 

        function toRadians(degrees) {
            return (degrees * Math.PI) / 180;
        }

        function calculateDistance(lat1, lon1, lat2, lon2) {
            var R = 6371; // Earth radius in km
            var dLat = toRadians(lat2 - lat1);
            var dLon = toRadians(lon2 - lon1);
            var a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRadians(lat1)) *
                    Math.cos(toRadians(lat2)) *
                    Math.sin(dLon / 2) *
                    Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        function generateArcPoints(start, end, distance) {
            const steps = 100;
            const arcHeight = Math.min(0.5, distance / 6) * 3; // Dynamic height based on distance
            let points = [];
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const lat = (1 - t) * start[1] + t * end[1];
                const lng = (1 - t) * start[0] + t * end[0];
                const height = Math.sin(Math.PI * t) * arcHeight * 1000; // Scale arcHeight for visibility
                points.push([lng, lat, height]);
            }
            return points;
        }

        function getColorByFrequency(frequency, minFrequency, maxFrequency) {
            const percent = (frequency - minFrequency) / (maxFrequency - minFrequency);
            const red = 255 * (1 - percent);
            const green = 255 * percent;
            return `rgb(${red}, ${green}, 0)`;
        }

        function loadData(dataType) {
            fetch(`./src/data/${dataType}_10m_frequency.json`)
                .then((response) => response.json())
                .then((data) => {
                    const allGraphics = [];
                    let maxFrequency = threshold;

                    // Find the maximum frequency
                    data.forEach(item => {
                        if (item.frequency > maxFrequency) {
                            maxFrequency = item.frequency;
                        }
                    });

                    data.forEach(function (item) {
                        if (
                            item.frequency > threshold && // Use the threshold
                            item.rent_lon &&
                            item.rent_lat &&
                            item.end_lon &&
                            item.end_lat &&
                            !(
                                item.rent_lon === item.end_lon &&
                                item.rent_lat === item.end_lat
                            )
                        ) {
                            const distance = calculateDistance(
                                item.rent_lat,
                                item.rent_lon,
                                item.end_lat,
                                item.end_lon
                            );
                            const arcPoints = generateArcPoints(
                                [item.rent_lon, item.rent_lat],
                                [item.end_lon, item.end_lat],
                                distance
                            );

                            var line = new Polyline({
                                hasZ: true, // Enable Z coordinate
                                paths: [arcPoints],
                            });

                            var lineColor = getColorByFrequency(item.frequency, threshold, maxFrequency);
                            var lineSymbol = new SimpleLineSymbol({
                                color: lineColor,
                                width: 1,
                            });

                            var lineGraphic = new Graphic({
                                geometry: line,
                                symbol: lineSymbol,
                            });

                            allGraphics.push(lineGraphic);
                        }
                    });

                    graphicsLayer.removeAll();

                    function addGraphicsInBatches(graphics, batchSize) {
                        let index = 0;

                        function addNextBatch() {
                            const batch = graphics.slice(index, index + batchSize);
                            graphicsLayer.addMany(batch);
                            index += batchSize;

                            if (index < graphics.length) {
                                requestAnimationFrame(addNextBatch);
                            }
                        }

                        requestAnimationFrame(addNextBatch);
                    }

                    addGraphicsInBatches(allGraphics, 100);
                    console.log("Load success.");
                })
                .catch((error) => console.error("Error loading the data:", error));
        }

        loadData("weekend");

        document.getElementById("dataSelect").addEventListener("change", function (event) {
            loadData(event.target.value);
        });

        document.getElementById("thresholdSlider").addEventListener("input", function (event) {
            threshold = parseInt(event.target.value);
            document.getElementById("thresholdValue").innerText = threshold;
            loadData(document.getElementById("dataSelect").value);
        });
    });
});
