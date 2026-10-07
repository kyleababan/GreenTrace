import * as Location from "expo-location";
import { Platform } from "react-native";

export async function getCurrentCoordinates() {
  let latitude;
  let longitude;

  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Location is not available in this browser.");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    });
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  } else {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error(
        "Location permission was denied. Allow GreenTrace to access your location in device settings.",
      );
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      throw new Error("Turn on Location Services and try again.");
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Your device returned invalid GPS coordinates.");
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}
