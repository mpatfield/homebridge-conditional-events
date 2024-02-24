import { Characteristic, CharacteristicValue, Logger, PlatformAccessory, Service, WithUUID } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { SensorType, Switch } from './models';

export type ValueChangeHandler = () => Promise<void>;

export abstract class BaseAccessory {

  protected readonly infoService: Service;

  constructor(
    protected readonly service: typeof Service,
    protected readonly characteristic: typeof Characteristic,
    protected readonly log: Logger,
    private readonly accessory: PlatformAccessory,
    protected readonly onChangeHandler?: ValueChangeHandler,
  ) {

    this.infoService = accessory.getService(service.AccessoryInformation) ||
    accessory.addService(service.AccessoryInformation);

    this.infoService
      .setCharacteristic(characteristic.Manufacturer, PLATFORM_NAME)
      .setCharacteristic(characteristic.SerialNumber, accessory.UUID.substring(0, 8))
      .setCharacteristic(characteristic.Name, accessory.displayName)
      .setCharacteristic(characteristic.ConfiguredName, accessory.displayName);
  }

  getName(): string {
    return this.accessory.displayName;
  }

  public abstract triggerEvent(): void;
}

export class SensorAccessory extends BaseAccessory {

  private readonly sensorService: Service;
  private readonly sensorCharacteristic: WithUUID<new () => Characteristic>;

  constructor(
    service: typeof Service,
    characteristic: typeof Characteristic,
    log: Logger,
    accessory: PlatformAccessory,
    private readonly sensorType: SensorType,
    onChangeHandler?: ValueChangeHandler,
  ) {
    super(service, characteristic, log, accessory, onChangeHandler);

    let serviceType: WithUUID<typeof Service>;
    let serviceConstructor: (displayName?: string, subtype?: string) => Service;

    switch (sensorType) {
      case SensorType.contact:
        this.infoService.setCharacteristic(characteristic.Model, 'Contact Sensor');
        serviceType = this.service.ContactSensor;
        serviceConstructor = function (name): Service {
          return new service.ContactSensor(name);
        };
        this.sensorCharacteristic = characteristic.ContactSensorState;
        break;
      case SensorType.leak:
        this.infoService.setCharacteristic(characteristic.Model, 'Leak Sensor');
        serviceType = this.service.LeakSensor;
        serviceConstructor = function (name): Service {
          return new service.LeakSensor(name);
        };
        this.sensorCharacteristic = characteristic.LeakDetected;
        break;
      case SensorType.motion:
        this.infoService.setCharacteristic(characteristic.Model, 'Motion Sensor');
        serviceType = this.service.MotionSensor;
        serviceConstructor = function (name): Service {
          return new service.MotionSensor(name);
        };
        this.sensorCharacteristic = characteristic.MotionDetected;
        break;
      case SensorType.occupancy:
      default:
        this.infoService.setCharacteristic(characteristic.Model, 'Occupancy Sensor');
        serviceType = this.service.OccupancySensor;
        serviceConstructor = function (name): Service {
          return new service.OccupancySensor(name);
        };
        this.sensorCharacteristic = characteristic.OccupancyDetected;
        break;
    }

    this.sensorService = accessory.getService(serviceType) || accessory.addService(serviceConstructor(this.getName()));
  }

  public triggerEvent() {

    let detected: boolean | number;
    let notDetected: boolean | number;

    switch (this.sensorType) {
      case SensorType.motion:
        detected = true;
        notDetected = false;
        break;
      case SensorType.contact:
      case SensorType.leak:
      case SensorType.occupancy:
      default:
        detected = 1;
        notDetected = 0;
        break;
    }

    this.sensorService.updateCharacteristic(this.sensorCharacteristic, detected);
    this.log.debug('Sensor event triggered:', this.getName());

    this.onChangeHandler?.();

    setTimeout(() => {
      this.log.debug('Sensor event concluded:', this.getName());
      this.sensorService.updateCharacteristic(this.sensorCharacteristic, notDetected);
    }, 1000);
  }
}

export abstract class BaseSwitchAccessory extends BaseAccessory {

  protected readonly switchService: Service;

  constructor(
    service: typeof Service,
    characteristic: typeof Characteristic,
    log: Logger,
    accessory: PlatformAccessory,
    protected readonly model: Switch,
    onChangeHandler?: ValueChangeHandler,
  ) {

    super(service, characteristic, log, accessory, onChangeHandler);

    this.switchService = accessory.getService(service.Switch) || accessory.addService(service.Switch, this.getName());

    this.switchService.getCharacteristic(characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.switchService.setCharacteristic(characteristic.On, this.model.getDefaultState());
    this.model.isOn = this.switchService.getCharacteristic(characteristic.On).value ? true : false;
  }

  private async getOn(): Promise<CharacteristicValue> {
    this.log.debug('getOn:', this.getName(), this.model.isOn);
    return this.model.isOn;
  }

  protected setOn(value: CharacteristicValue): void {
    this.model.isOn = value ? true : false;
    this.log.debug('setOn:', this.getName(), this.model.isOn);
    this.onChangeHandler?.();
  }

  public triggerEvent() {
    this.switchService.updateCharacteristic(this.characteristic.On, true);
    this.setOn(true);
  }
}

export class ManualSwitchAccessory extends BaseSwitchAccessory {

  constructor(
    service: typeof Service,
    characteristic: typeof Characteristic,
    log: Logger,
    accessory: PlatformAccessory,
    model: Switch,
    onChangeHandler?: ValueChangeHandler,
  ) {
    super(service, characteristic, log, accessory, model, onChangeHandler);
    this.infoService.setCharacteristic(characteristic.Model, 'Manual Switch');
  }

}

export class AutoOffSwitchAccessory extends BaseSwitchAccessory {

  private timer: NodeJS.Timeout | undefined;

  constructor(
    service: typeof Service,
    characteristic: typeof Characteristic,
    log: Logger,
    accessory: PlatformAccessory,
    model: Switch,
    onChangeHandler?: ValueChangeHandler,
  ) {
    super(service, characteristic, log, accessory, model, onChangeHandler);
    this.infoService.setCharacteristic(characteristic.Model, 'Auto Off Switch');
  }

  protected async setOn(value: CharacteristicValue) {
    super.setOn(value);

    if(!this.model.isOn) {
      this.resetTimer();
      return;
    }

    if(this.model.isResettable()) {
      this.log.debug('Resetting timer:', this.getName());
      this.resetTimer();
    } else if (this.timer) {
      this.log.debug('Timer already set:', this.getName());
      return;
    }

    this.timer = setTimeout(() => {
      this.log.debug('Timer fired:', this.getName());
      this.switchService.updateCharacteristic(this.characteristic.On, false);
      this.setOn(false);
    }, this.model.getOffTimer() * 1000);
  }

  private resetTimer() {
    if (!this.timer) {
      this.log.debug('No timer to reset:', this.getName());
      return;
    }
    clearTimeout(this.timer);
    this.timer = undefined;
    this.log.debug('Timer reset:', this.getName());
  }
}