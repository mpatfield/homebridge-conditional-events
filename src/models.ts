import { Logger, PlatformConfig } from 'homebridge';

import { ConditionConfig } from './config';

export enum TriggerMethod {
  sensor = 'sensor',
  switch = 'switch'
}

export enum SensorType {
  contact = 'contact',
  occupancy = 'occupancy',
  leak = 'leak',
  motion = 'motion'
}

export enum SwitchType {
  auto = 'auto',
  manual = 'manual'
}

export enum SwitchState {
  on = 'on',
  off = 'off'
}

export enum Operator {
  and = 'and',
  or = 'or'
}

export class Sensor {

  constructor(
    readonly config: PlatformConfig,
  ) {
  }

  getName(): string {
    return this.config.name ?? '';
  }

  getType(): SensorType {
    return this.config.sensorType;
  }
}

export class Switch {

  isOn = false;

  constructor(
    readonly config: PlatformConfig,
  ) {
  }

  isResettable(): boolean {
    return this.config.switchSettings.resettable;
  }

  getName(): string {
    return this.config.name ?? '';
  }

  getType(): SwitchType {
    return this.config.switchSettings.type;
  }

  getDefaultState(): boolean {
    return this.config.switchSettings.defaultState === SwitchState.on;
  }

  getOffTimer(): number {
    return this.config.switchSettings.offTimer;
  }
}


export class ConditionSwitch extends Switch {

  constructor(
    readonly config: ConditionConfig,
  ) {
    super(config);
  }

  getFlip(): boolean {
    return this.config.flip;
  }

  getOperator(): Operator {
    return this.config.operator;
  }
}

export function evaluateConditions(conditions: ConditionSwitch[], log: Logger): boolean {

  let result = false;
  let nextOperator: Operator | undefined;

  for (const condition of conditions) {

    let current = condition.isOn;
    if(condition.getFlip()) {
      current = !current;
    }

    log.debug('Evaluating condition:', condition.getName(), current);

    switch(nextOperator) {
      case Operator.and:
        log.debug('result && current:', result, current);
        result = result && current;
        break;
      case Operator.or:
        log.debug('result || current:', result, current);
        result = result || current;
        break;
      default:
        log.debug('Setting result to current:', current);
        result = current;
        break;
    }

    log.debug('Current evalutation result:', condition.getName(), result);

    nextOperator = condition.getOperator();
  }

  return result;
}