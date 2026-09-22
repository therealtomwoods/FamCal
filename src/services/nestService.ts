import { NestThermostatState } from '../types';

interface SDMDevice {
  name: string; // e.g. enterprises/{project_id}/devices/{device_id}
  type: string;
  traits: {
    'sdm.devices.traits.Info'?: {
      customName?: string;
    };
    'sdm.devices.traits.Temperature'?: {
      ambientTemperatureCelsius: number;
    };
    'sdm.devices.traits.Humidity'?: {
      ambientHumidityPercent: number;
    };
    'sdm.devices.traits.ThermostatMode'?: {
      mode: 'MANUAL' | 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF';
      availableModes?: string[];
    };
    'sdm.devices.traits.ThermostatTemperatureSetpoint'?: {
      heatCelsius?: number;
      coolCelsius?: number;
    };
    'sdm.devices.traits.ThermostatHvac'?: {
      status: 'HEATING' | 'COOLING' | 'OFF';
    };
    'sdm.devices.traits.ThermostatEco'?: {
      availableModes?: string[];
      mode: 'MANUAL_ECO' | 'OFF';
      heatCelsius?: number;
      coolCelsius?: number;
    };
  };
  parentRelations?: Array<{
    parent: string;
    displayName: string;
  }>;
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

export async function fetchRealNestThermostat(
  token: string,
  projectId: string,
  tempUnits: 'F' | 'C' = 'F'
): Promise<NestThermostatState | null> {
  if (!projectId || projectId.trim() === '') {
    return null;
  }

  const cleanProjectId = projectId.trim();
  const url = `https://smartdevicemanagement.googleapis.com/v1/enterprises/${cleanProjectId}/devices`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`Nest SDM API returned ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const devices: SDMDevice[] = data.devices || [];

    // Find the first thermostat device
    const thermostat = devices.find(
      (d) =>
        d.type === 'sdm.devices.types.THERMOSTAT' ||
        d.traits['sdm.devices.traits.ThermostatMode'] !== undefined
    );

    if (!thermostat) {
      console.warn('No Nest Thermostat device found in project');
      return null;
    }

    const ambientC = thermostat.traits['sdm.devices.traits.Temperature']?.ambientTemperatureCelsius ?? 21.5;
    const humidity = thermostat.traits['sdm.devices.traits.Humidity']?.ambientHumidityPercent ?? 45;
    const rawMode = thermostat.traits['sdm.devices.traits.ThermostatMode']?.mode || 'COOL';
    const hvacStatus = thermostat.traits['sdm.devices.traits.ThermostatHvac']?.status || 'OFF';
    const ecoTrait = thermostat.traits['sdm.devices.traits.ThermostatEco'];

    const setpoints = thermostat.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
    let targetC = 21;
    if (rawMode === 'HEAT' && setpoints?.heatCelsius) {
      targetC = setpoints.heatCelsius;
    } else if (rawMode === 'COOL' && setpoints?.coolCelsius) {
      targetC = setpoints.coolCelsius;
    } else if (setpoints?.coolCelsius || setpoints?.heatCelsius) {
      targetC = setpoints.coolCelsius || setpoints.heatCelsius || 21;
    }

    const isEco = ecoTrait?.mode === 'MANUAL_ECO';
    const mode = isEco
      ? 'eco'
      : rawMode === 'HEAT'
      ? 'heat'
      : rawMode === 'COOL'
      ? 'cool'
      : 'cool';

    const status =
      hvacStatus === 'HEATING'
        ? 'heating'
        : hvacStatus === 'COOLING'
        ? 'cooling'
        : 'idle';

    const roomName = thermostat.parentRelations?.[0]?.displayName;
    const customName = thermostat.traits['sdm.devices.traits.Info']?.customName;
    const deviceName = customName || (roomName ? `${roomName} Thermostat` : 'Nest Thermostat');

    const currentTemp = tempUnits === 'F' ? cToF(ambientC) : Math.round(ambientC);
    const targetTemp = tempUnits === 'F' ? cToF(targetC) : Math.round(targetC);

    return {
      currentTemp,
      targetTemp,
      mode,
      status,
      humidity,
      deviceName,
      eco: isEco,
      deviceId: thermostat.name,
      isRealDevice: true,
    };
  } catch (error) {
    console.error('Failed to fetch real Nest Thermostat data:', error);
    return null;
  }
}

export async function setNestTargetTemperature(
  token: string,
  deviceId: string,
  newTemp: number,
  mode: 'heat' | 'cool' | 'eco' | 'off',
  tempUnits: 'F' | 'C' = 'F'
): Promise<boolean> {
  const targetCelsius = tempUnits === 'F' ? fToC(newTemp) : newTemp;
  const commandName =
    mode === 'heat'
      ? 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat'
      : 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetCool';

  const paramKey = mode === 'heat' ? 'heatCelsius' : 'coolCelsius';

  const url = `https://smartdevicemanagement.googleapis.com/v1/${deviceId}:executeCommand`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: commandName,
        params: {
          [paramKey]: Math.round(targetCelsius * 2) / 2, // Nest expects 0.5 deg steps
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update Nest target temperature:', err);
    return false;
  }
}
