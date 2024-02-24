import { PlatformConfig } from 'homebridge';

import { Operator, SensorType, SwitchState, SwitchType, TriggerMethod } from './models';

export interface SwitchSettingsConfig extends PlatformConfig {
    defaultState: SwitchState;
    type: SwitchType;
    offTimer: number;
    resettable: boolean;
}

export interface SwitchConfig extends PlatformConfig {
    name: string;
    switchSettings: SwitchSettingsConfig;
}

export interface ConditionConfig extends SwitchConfig {
    flip: boolean;
    operator: Operator;
}

export interface EventConditionsConfig extends SwitchConfig {
    debug: boolean;

    name: string;
    triggerMethod: TriggerMethod;
    sensorType: SensorType;

    conditions: ConditionConfig[];
}