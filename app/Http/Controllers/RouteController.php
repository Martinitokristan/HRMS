<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class RouteController extends Controller
{
    /**
     * Get road route from OpenRouteService API
     */
    public function getRoute(Request $request)
    {
        try {
            $validated = $request->validate([
                'start_lat' => 'required|numeric|min:-90|max:90',
                'start_lon' => 'required|numeric|min:-180|max:180',
                'end_lat' => 'required|numeric|min:-90|max:90',
                'end_lon' => 'required|numeric|min:-180|max:180',
            ]);

            $startLat = $validated['start_lat'];
            $startLon = $validated['start_lon'];
            $endLat = $validated['end_lat'];
            $endLon = $validated['end_lon'];

            // Create cache key
            $cacheKey = "route_{$startLat}_{$startLon}_{$endLat}_{$endLon}";
            
            // Check cache first
            if (Cache::has($cacheKey)) {
                return response()->json(Cache::get($cacheKey));
            }

            // Call OSRM API (free demo server)
            $url = "https://router.project-osrm.org/route/v1/driving/{$startLon},{$startLat};{$endLon},{$endLat}";
            
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->get($url, [
                'overview' => 'full',
                'geometries' => 'geojson'
            ]);

            if (!$response->successful()) {
                \Log::error('OSRM API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'coordinates' => [$startLat, $startLon, $endLat, $endLon]
                ]);
                
                // Return fallback curved route when API fails
                $intermediatePoints = $this->generateCurvedRoute($startLat, $startLon, $endLat, $endLon);
                return response()->json([
                    'type' => 'FeatureCollection',
                    'features' => [
                        [
                            'type' => 'Feature',
                            'geometry' => [
                                'type' => 'LineString',
                                'coordinates' => $intermediatePoints
                            ],
                            'properties' => [
                                'segments' => [
                                    [
                                        'distance' => $this->calculateDistance($startLat, $startLon, $endLat, $endLon),
                                        'duration' => $this->estimateDuration($startLat, $startLon, $endLat, $endLon)
                                    ]
                                ],
                                'fallback' => true,
                                'message' => 'Using curved route approximation due to API unavailability'
                            ]
                        ]
                    ]
                ]);
            }

            $osrmData = $response->json();
            
            // Check if OSRM returned a route
            if (!isset($osrmData['routes']) || empty($osrmData['routes'])) {
                \Log::warning('No route found from OSRM', [
                    'response' => $osrmData,
                    'coordinates' => [$startLat, $startLon, $endLat, $endLon]
                ]);
                
                // Return fallback curved route
                $intermediatePoints = $this->generateCurvedRoute($startLat, $startLon, $endLat, $endLon);
                return response()->json([
                    'type' => 'FeatureCollection',
                    'features' => [
                        [
                            'type' => 'Feature',
                            'geometry' => [
                                'type' => 'LineString',
                                'coordinates' => $intermediatePoints
                            ],
                            'properties' => [
                                'segments' => [
                                    [
                                        'distance' => $this->calculateDistance($startLat, $startLon, $endLat, $endLon),
                                        'duration' => $this->estimateDuration($startLat, $startLon, $endLat, $endLon)
                                    ]
                                ],
                                'fallback' => true,
                                'message' => 'No route found, using curved route approximation'
                            ]
                        ]
                    ]
                ]);
            }

            // Convert OSRM response to expected GeoJSON format
            $route = $osrmData['routes'][0];
            $coordinates = $route['geometry']['coordinates'];
            
            $geoJsonData = [
                'type' => 'FeatureCollection',
                'features' => [
                    [
                        'type' => 'Feature',
                        'geometry' => [
                            'type' => 'LineString',
                            'coordinates' => $coordinates
                        ],
                        'properties' => [
                            'segments' => [
                                [
                                    'distance' => $route['distance'], // OSRM provides distance in meters
                                    'duration' => $route['duration']  // OSRM provides duration in seconds
                                ]
                            ],
                            'fallback' => false,
                            'message' => 'Real road route from OSRM'
                        ]
                    ]
                ]
            ];
            
            // Cache the result for 1 hour
            Cache::put($cacheKey, $geoJsonData, 3600);
            
            \Log::info('Route fetched successfully from OSRM', [
                'coordinates' => [$startLat, $startLon, $endLat, $endLon],
                'distance' => $route['distance'],
                'duration' => $route['duration']
            ]);

            return response()->json($geoJsonData);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $e->errors()
            ], 422);
            
        } catch (\Exception $e) {
            \Log::error('Route API error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371; // Earth's radius in kilometers

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c * 1000; // Return distance in meters
    }

    /**
     * Estimate duration based on distance (assuming average speed of 40 km/h in urban areas)
     */
    private function estimateDuration($lat1, $lon1, $lat2, $lon2)
    {
        $distance = $this->calculateDistance($lat1, $lon1, $lat2, $lon2); // in meters
        $averageSpeed = 40 / 3.6; // 40 km/h converted to m/s
        
        return $distance / $averageSpeed; // Return duration in seconds
    }

    /**
     * Generate a curved route approximation with intermediate points
     */
    private function generateCurvedRoute($startLat, $startLon, $endLat, $endLon)
    {
        $points = [[$startLon, $startLat]];
        
        // Add 3-5 intermediate points to create a more realistic path
        $numIntermediate = rand(3, 5);
        
        for ($i = 1; $i < $numIntermediate; $i++) {
            $progress = $i / $numIntermediate;
            
            // Basic interpolation with some randomness to simulate road curves
            $lat = $startLat + ($endLat - $startLat) * $progress;
            $lon = $startLon + ($endLon - $startLon) * $progress;
            
            // Add some curve to the path (simulate following roads)
            $curveFactor = 0.001; // Small offset in degrees
            $latOffset = sin($progress * pi()) * $curveFactor * (rand(0, 1) ? 1 : -1);
            $lonOffset = cos($progress * pi()) * $curveFactor * (rand(0, 1) ? 1 : -1);
            
            $points[] = [$lon + $lonOffset, $lat + $latOffset];
        }
        
        $points[] = [$endLon, $endLat];
        
        return $points;
    }
}
