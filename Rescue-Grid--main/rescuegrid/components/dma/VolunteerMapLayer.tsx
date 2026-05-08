'use client'

import { useMemo, useCallback } from 'react'
import { Source, Layer, type LayerProps } from 'react-map-gl/mapbox'
import type { Volunteer } from '@/hooks/useVolunteers'

interface VolunteerMapLayerProps {
  volunteers: Volunteer[]
  onVolunteerClick?: (volunteer: Volunteer) => void
  onClusterClick?: (clusterId: number, coordinates: [number, number]) => void
}

const clusterLayer: LayerProps = {
  id: 'volunteers-clusters',
  type: 'circle',
  source: 'volunteers',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step', ['get', 'point_count'],
      '#4CAF50',   10, '#FF9800', 30, '#F44336'
    ] as any,
    'circle-radius': [
      'step', ['get', 'point_count'],
      20, 10, 26, 30, 32
    ] as any,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.92,
  },
}

const clusterCountLayer: LayerProps = {
  id: 'volunteers-cluster-count',
  type: 'symbol',
  source: 'volunteers',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 13,
  },
  paint: {
    'text-color': '#ffffff',
  },
}

const volunteerLabelLayer: LayerProps = {
  id: 'volunteers-label',
  type: 'symbol',
  source: 'volunteers',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'text-field': 'V',
    'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
    'text-size': 12,
    'text-allow-overlap': true,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,0.3)',
    'text-halo-width': 1,
  },
}

const unclusteredLayer: LayerProps = {
  id: 'volunteers-unclustered',
  type: 'circle',
  source: 'volunteers',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': [
      'case',
      ['==', ['get', 'status'], 'on-mission'], '#FF6B2B',
      ['==', ['get', 'status'], 'standby'], '#F5A623',
      '#2ECC71'
    ] as any,
    'circle-radius': [
      'case',
      ['>=', ['get', 'tier'], 4], 18,
      ['==', ['get', 'tier'], 3], 15,
      ['==', ['get', 'tier'], 2], 13,
      11
    ] as any,
    'circle-stroke-width': 3,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': [
      'case',
      ['==', ['get', 'status'], 'active'], 1.0,
      0.75
    ] as any,
  },
}

export function VolunteerMapLayer({ volunteers, onVolunteerClick, onClusterClick }: VolunteerMapLayerProps) {
  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: volunteers
      .filter(v => v.latitude && v.longitude)
      .map(v => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [v.longitude, v.latitude],
        },
        properties: {
          id: v.id,
          name: v.name,
          tier: v.tier ?? 1,
          status: v.status,
          score: v.score ?? 0,
          skills: Array.isArray(v.skills) ? v.skills.join(',') : (v.skills ?? ''),
        },
      })),
  }), [volunteers])

  const handleClick = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    if (!e.features?.length) return

    const feature = e.features[0]

    if (feature.properties?.cluster) {
      const clusterId = feature.properties.cluster_id
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
      onClusterClick?.(clusterId, coordinates)
      return
    }

    const volunteerId = feature.properties?.id
    if (volunteerId) {
      const volunteer = volunteers.find(v => v.id === volunteerId)
      if (volunteer) {
        onVolunteerClick?.(volunteer)
      }
    }
  }, [volunteers, onVolunteerClick, onClusterClick])

  return (
    <Source
      id="volunteers"
      type="geojson"
      data={geojson}
      cluster={true}
      clusterMaxZoom={11}
      clusterRadius={50}
      clusterProperties={{
        maxTier: ['max', ['get', 'tier']],
        totalCount: ['+', 1]
      }}
    >
      <Layer {...clusterLayer} />
      <Layer {...clusterCountLayer} />
      <Layer {...unclusteredLayer} />
      <Layer {...volunteerLabelLayer} />
    </Source>
  )
}
