export const geocodeAddress = async (apiKey: string, address: string) => {
  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${apiKey}`);
    const data = await response.json();
    return data.features?.[0];
  } catch (error) {
    console.error("Mapbox Geocoding Error:", error);
    return null;
  }
};

export const getStaticMapUrl = (apiKey: string, longitude: number, latitude: number, zoom: number = 12) => {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${longitude},${latitude},${zoom},0/600x400?access_token=${apiKey}`;
}

export const getNavigationRoute = async (apiKey: string, start: [number, number], end: [number, number]) => {
    try {
        const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${apiKey}`);
        const data = await response.json();
        return data.routes?.[0];
    } catch (e) {
        console.error("Mapbox Direction Error", e);
        return null;
    }
}
