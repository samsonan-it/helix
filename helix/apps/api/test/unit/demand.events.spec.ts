import {
  DemandEventBase,
  DemandSubmittedEvent,
  DemandApprovedEvent,
  DemandRejectedEvent,
  DemandReroutedEvent,
  DemandPromotedEvent,
  DemandCancelledEvent,
  DemandTypeChangedEvent,
  DemandAcceptedEvent,
  DemandDmRejectedEvent,
  DemandDmReroutedEvent,
  DemandPmApprovedEvent,
  DemandPmRejectedEvent,
  DemandPmSentToRequesterEvent,
  DemandPmSentToDmEvent,
  DEMAND_EVENTS,
} from '../../src/notifications/events/demand.events';

describe('demand.events', () => {
  const demandId = 'demand-1';
  const actorId = 'user-1';

  it.each([
    DemandSubmittedEvent,
    DemandApprovedEvent,
    DemandRejectedEvent,
    DemandReroutedEvent,
    DemandPromotedEvent,
    DemandCancelledEvent,
    DemandTypeChangedEvent,
    DemandAcceptedEvent,
  ])('%s extends DemandEventBase', (EventClass) => {
    const evt = new EventClass(demandId, actorId);
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe(demandId);
    expect(evt.actorId).toBe(actorId);
    expect(evt.timestamp).toBeInstanceOf(Date);
  });

  it('DemandDmRejectedEvent carries rejection reason', () => {
    const reason = 'Does not meet budget criteria';
    const evt = new DemandDmRejectedEvent(demandId, actorId, reason);
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe(demandId);
    expect(evt.actorId).toBe(actorId);
    expect(evt.reason).toBe(reason);
    expect(evt.timestamp).toBeInstanceOf(Date);
  });

  it('DemandDmReroutedEvent carries rework commentary', () => {
    const commentary = 'Please revise the financial section';
    const evt = new DemandDmReroutedEvent(demandId, actorId, commentary);
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe(demandId);
    expect(evt.actorId).toBe(actorId);
    expect(evt.commentary).toBe(commentary);
    expect(evt.timestamp).toBeInstanceOf(Date);
  });

  it('DEMAND_EVENTS values are all non-empty strings', () => {
    for (const key of Object.keys(DEMAND_EVENTS) as Array<keyof typeof DEMAND_EVENTS>) {
      expect(typeof DEMAND_EVENTS[key]).toBe('string');
      expect(DEMAND_EVENTS[key].length).toBeGreaterThan(0);
    }
  });

  it('DEMAND_EVENTS has exactly 24 keys', () => {
    expect(Object.keys(DEMAND_EVENTS)).toHaveLength(24);
  });

  it('DEMAND_EVENTS keys match expected event names', () => {
    expect(DEMAND_EVENTS.SUBMITTED).toBe('demand.submitted');
    expect(DEMAND_EVENTS.APPROVED).toBe('demand.approved');
    expect(DEMAND_EVENTS.REJECTED).toBe('demand.rejected');
    expect(DEMAND_EVENTS.REROUTED).toBe('demand.rerouted');
    expect(DEMAND_EVENTS.PROMOTED).toBe('demand.promoted');
    expect(DEMAND_EVENTS.CANCELLED).toBe('demand.cancelled');
    expect(DEMAND_EVENTS.TYPE_CHANGED).toBe('demand.typeChanged');
    expect(DEMAND_EVENTS.ACCEPTED).toBe('demand.accepted');
    expect(DEMAND_EVENTS.DM_REJECTED).toBe('demand.dmRejected');
    expect(DEMAND_EVENTS.DM_REROUTED).toBe('demand.dmRerouted');
    expect(DEMAND_EVENTS.PM_APPROVED).toBe('demand.pmApproved');
    expect(DEMAND_EVENTS.PM_REJECTED).toBe('demand.pmRejected');
    expect(DEMAND_EVENTS.RETURNED).toBe('demand.returned');
    // Story 4.11 — BC events
    expect(DEMAND_EVENTS.BC_REVIEW_STARTED).toBe('demand.bcReviewStarted');
    expect(DEMAND_EVENTS.BC_APPROVED).toBe('demand.bcApproved');
    expect(DEMAND_EVENTS.BC_REJECTED).toBe('demand.bcRejected');
    expect(DEMAND_EVENTS.BC_REROUTED_TO_REQUESTER).toBe('demand.bcReroutedToRequester');
    // Story 4.13 — PM send-back events
    expect(DEMAND_EVENTS.PM_SENT_TO_REQUESTER).toBe('demand.pmSentToRequester');
    expect(DEMAND_EVENTS.PM_SENT_TO_DM).toBe('demand.pmSentToDm');
    // Story 4.14 — P→SP type switch
    expect(DEMAND_EVENTS.DEMAND_TYPE_SWITCHED).toBe('demand.typeSwitched');
    // Story 4.5 — SP notification events
    expect(DEMAND_EVENTS.SP_DM_ACCEPTED).toBe('demand.spDmAccepted');
    expect(DEMAND_EVENTS.SP_OFFER_SENT).toBe('demand.spOfferSent');
    expect(DEMAND_EVENTS.SP_OFFER_ACCEPTED).toBe('demand.spOfferAccepted');
    expect(DEMAND_EVENTS.SP_OFFER_REWORKED).toBe('demand.spOfferReworked');
  });

  it('DemandPmApprovedEvent extends DemandEventBase', () => {
    const evt = new DemandPmApprovedEvent('d-1', 'u-1');
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe('d-1');
  });

  it('DemandPmRejectedEvent carries PM commentary', () => {
    const evt = new DemandPmRejectedEvent('d-1', 'u-1', 'Not aligned');
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.pmCommentary).toBe('Not aligned');
  });

  it('DemandPmSentToRequesterEvent carries commentary', () => {
    const evt = new DemandPmSentToRequesterEvent('d-1', 'u-1', 'Needs revision');
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe('d-1');
    expect(evt.commentary).toBe('Needs revision');
  });

  it('DemandPmSentToDmEvent carries commentary', () => {
    const evt = new DemandPmSentToDmEvent('d-1', 'u-1', 'Estimation incomplete');
    expect(evt).toBeInstanceOf(DemandEventBase);
    expect(evt.demandId).toBe('d-1');
    expect(evt.commentary).toBe('Estimation incomplete');
  });
});
