import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '72', 10);
  const now = new Date();
  const timeWindow = new Date(now.getTime() - hours * 60 * 60 * 1000);

  try {
    // 1. Fetch Cities
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    // 2. Fetch Active Supply (Inventario vivo)
    const activeActivities = await prisma.activity.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      },
      select: { locationId: true },
    });

    // Resolve locationId to cityId
    const activeLocationIds = [...new Set(activeActivities.map(a => a.locationId).filter(Boolean) as string[])];
    
    const supplyByCity: Record<string, number> = {};
    if (activeLocationIds.length > 0) {
      const locations = await prisma.location.findMany({
        where: { id: { in: activeLocationIds } },
        select: { id: true, cityId: true }
      });
      
      const locationCityMap = new Map(locations.map(l => [l.id, l.cityId]));
      
      activeActivities.forEach(act => {
        if (act.locationId) {
          const cityId = locationCityMap.get(act.locationId);
          if (cityId) {
            supplyByCity[cityId] = (supplyByCity[cityId] || 0) + 1;
          }
        }
      });
    }

    // 3. Global Raw Events (for the top cards)
    const globalEvents = await prisma.event.groupBy({
      by: ["type"],
      _count: true,
      where: { createdAt: { gte: timeWindow } }
    });

    // 4. Fetch City-specific events to process in memory
    const cityEvents = await prisma.event.findMany({
      where: {
        createdAt: { gte: timeWindow },
        type: { in: ['city_modal_open', 'city_selected', 'city_modal_close_no_select', 'page_view'] }
      },
      select: { type: true, metadata: true, path: true }
    });

    // Process events per city
    const cityMetrics: Record<string, { visits: number, modalOpens: number, selections: number, escapes: number }> = {};
    
    // Initialize cities
    cities.forEach(city => {
      cityMetrics[city.id] = { visits: 0, modalOpens: 0, selections: 0, escapes: 0 };
    });

    cityEvents.forEach(ev => {
      let sourceCityId = null;
      let targetCityId = null;

      if (ev.metadata && typeof ev.metadata === 'object') {
         const meta = ev.metadata as Record<string, unknown>;
         if ('sourceCityId' in meta) sourceCityId = meta.sourceCityId as string;
         if ('cityId' in meta) targetCityId = meta.cityId as string;
      }
      
      // Heuristic: If it's a page_view, try to extract cityId from metadata or just count 0 for now
      if (ev.type === 'page_view' && targetCityId && cityMetrics[targetCityId]) {
        cityMetrics[targetCityId].visits++;
      }

      if (ev.type === 'city_modal_open' && sourceCityId && cityMetrics[sourceCityId]) {
         cityMetrics[sourceCityId].modalOpens++;
      }

      if (ev.type === 'city_selected' && targetCityId && cityMetrics[targetCityId]) {
         cityMetrics[targetCityId].selections++;
      }

      // Escape rate: They were in sourceCityId and selected targetCityId
      if (ev.type === 'city_selected' && sourceCityId && sourceCityId !== targetCityId && cityMetrics[sourceCityId]) {
         cityMetrics[sourceCityId].escapes++;
      }
    });

    // 5. Fetch Filter Analytics
    const filterEventsRaw = await prisma.event.findMany({
      where: {
        createdAt: { gte: timeWindow },
        type: 'filter_applied'
      },
      select: { metadata: true }
    });

    const filterStats: Record<string, { count: number, zeroResults: number, withQuery: number }> = {};
    
    filterEventsRaw.forEach(ev => {
      const meta = ev.metadata as Record<string, any>;
      if (!meta || !meta.filterType || !meta.filterValue) return;
      
      const key = `${meta.filterType}:${meta.filterValue}`;
      if (!filterStats[key]) {
        filterStats[key] = { count: 0, zeroResults: 0, withQuery: 0 };
      }
      
      filterStats[key].count++;
      if (meta.resultsCount === 0) filterStats[key].zeroResults++;
      if (meta.query) filterStats[key].withQuery++;
    });

    const filters = Object.entries(filterStats).map(([key, stats]) => {
      const [type, value] = key.split(':');
      return { type, value, ...stats };
    });

    // Build the final response
    const matrix = cities.map(city => {
      const metrics = cityMetrics[city.id] || { visits: 0, modalOpens: 0, selections: 0, escapes: 0 };
      const activeSupply = supplyByCity[city.id] || 0;
      
      return {
        cityId: city.id,
        cityName: city.name,
        activeSupply,
        visits: metrics.visits,
        modalOpens: metrics.modalOpens,
        selections: metrics.selections,
        escapes: metrics.escapes,
      };
    });

    return NextResponse.json({
      globalEvents,
      matrix,
      filters
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
