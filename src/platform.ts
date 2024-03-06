import { API, Characteristic, DynamicPlatformPlugin, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { Logger } from 'homebridge/lib/logger';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import { ConditionSwitch, Sensor, Switch, SwitchType, TriggerMethod } from './models';
import { ConditionConfig } from './config';

import { AutoOffSwitchAccessory, BaseAccessory, BaseSwitchAccessory, ManualSwitchAccessory, SensorAccessory } from './accessories';
import { EventController } from './controller';

export class HomebridgeConditionalEventsPlatform implements DynamicPlatformPlugin {

  private readonly service: typeof Service = this.api.hap.Service;
  private readonly characteristic: typeof Characteristic = this.api.hap.Characteristic;

  private readonly log: Logger;

  private readonly accessories: PlatformAccessory[] = [];

  constructor(
    _: Logger,
    private readonly config: PlatformConfig,
    private readonly api: API,
  ) {

    this.log = Logger.withPrefix(PLATFORM_NAME);
    Logger.setDebugEnabled(this.config.debug);

    api.on('didFinishLaunching', () => {
      this.setupAccessories();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  setupAccessories() {

    let eventAccessory: BaseAccessory | undefined;

    switch(this.config.triggerMethod) {
      case TriggerMethod.sensor: {
        const sensor = new Sensor(this.config);
        eventAccessory = this.registerAccessory(sensor.getName(), (accessory): BaseAccessory => {
          return new SensorAccessory(this.service, this.characteristic, this.log, accessory, sensor.getType());
        });
        break;
      }
      case TriggerMethod.switch:
      default: {
        const aSwitch = new Switch(this.config);
        eventAccessory = this.registerAccessory(aSwitch.getName(), (accessory): BaseAccessory => {
          return this.constructSwitchAccessory(aSwitch, accessory);
        });
        break;
      }
    }

    if(!eventAccessory) {
      return;
    }

    const conditions: ConditionSwitch[] = this.config.conditions.map(
      (conditionConfig: ConditionConfig) => new ConditionSwitch(conditionConfig),
    );

    const eventController = new EventController(eventAccessory, conditions, this.config.operator, this.log);
    for (const condition of conditions) {
      this.registerAccessory(condition.getName(), (accessory): BaseAccessory => {
        return this.constructSwitchAccessory(condition, accessory, eventController);
      });
    }
  }

  private registerAccessory(name: string, constructor: (accessory: PlatformAccessory) => BaseAccessory): BaseAccessory {

    const uuid = this.api.hap.uuid.generate(PLATFORM_NAME + name);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.debug('Restoring accessory from cache:', name);
      return constructor(existingAccessory);
    }

    const accessory = new this.api.platformAccessory(name, uuid);
    const baseAccessory = constructor(accessory);

    this.log.debug('Adding new sensor accessory:', name);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

    return baseAccessory;
  }

  private constructSwitchAccessory(aSwitch: Switch, accessory: PlatformAccessory, controller?: EventController): BaseSwitchAccessory {
    const onChangeHandler = controller?.onChange.bind(controller);
    switch(aSwitch.getType()) {
      case SwitchType.auto:
        return new AutoOffSwitchAccessory(this.service, this.characteristic, this.log, accessory, aSwitch, onChangeHandler);
      case SwitchType.manual:
      default:
        return new ManualSwitchAccessory(this.service, this.characteristic, this.log, accessory, aSwitch, onChangeHandler);
    }
  }
}
