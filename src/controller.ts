import { Logger } from 'homebridge';

import { BaseAccessory } from './accessories';
import { ConditionSwitch, Operator, evaluateConditions } from './models';

export class EventController {

  constructor(
    private readonly eventAccessory: BaseAccessory,
    private readonly conditions: ConditionSwitch[],
    private readonly operator: Operator,
    private readonly log: Logger) {
  }

  public async onChange(): Promise<void> {

    const result = evaluateConditions(this.conditions, this.operator, this.log);

    if (!result){
      this.log.debug('Conditions Not Satisfied:', this.eventAccessory.getName());
      return;
    }

    this.log.debug('Conditions Satisfied:', this.eventAccessory.getName());
    this.eventAccessory.triggerEvent();
  }
}