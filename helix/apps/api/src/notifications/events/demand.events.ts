export class DemandEventBase {
  constructor(
    public readonly demandId: string,
    public readonly actorId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DemandSubmittedEvent   extends DemandEventBase {}
export class DemandApprovedEvent    extends DemandEventBase {}
export class DemandRejectedEvent    extends DemandEventBase { reason!: string }
export class DemandReroutedEvent    extends DemandEventBase { targetRoleId!: string }
export class DemandPromotedEvent    extends DemandEventBase { projectId!: string }
export class DemandCancelledEvent   extends DemandEventBase {}
export class DemandTypeChangedEvent extends DemandEventBase {
  from!: string;
  to!: string;
}
// Story 4.1 — DM workflow events
export class DemandAcceptedEvent  extends DemandEventBase {}
export class DemandDmRejectedEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly reason: string) {
    super(demandId, actorId);
  }
}
export class DemandDmReroutedEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly commentary: string) {
    super(demandId, actorId);
  }
}

// Story 4.2 — PM workflow events
export class DemandPmApprovedEvent extends DemandEventBase {}
export class DemandPmRejectedEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly pmCommentary: string) {
    super(demandId, actorId);
  }
}

// Story 4.3 — SP originator reworks offer back to DM
export class DemandReturnedEvent extends DemandEventBase {}

// Story 4.5 — SP notification events
export class DemandSpDmAcceptedEvent extends DemandEventBase {}
export class DemandSpOfferSentEvent extends DemandEventBase {}
export class DemandSpOfferAcceptedEvent extends DemandEventBase {}
export class DemandSpOfferReworkedEvent extends DemandEventBase {}

// Story 4.13 — PM send-back events (handlers wired in Story 4.16)
export class DemandPmSentToRequesterEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly commentary: string) {
    super(demandId, actorId);
  }
}
export class DemandPmSentToDmEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly commentary: string) {
    super(demandId, actorId);
  }
}

// Story 4.14 — P→SP type switch
export class DemandTypeSwitchedEvent extends DemandEventBase {}

// Story 4.11 — BC workflow events (handlers wired in Story 4.16)
export class DemandBcReviewStartedEvent extends DemandEventBase {}
export class DemandBcApprovedEvent extends DemandEventBase {}
export class DemandBcRejectedEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly commentary: string) {
    super(demandId, actorId);
  }
}
export class DemandBcReroutedToRequesterEvent extends DemandEventBase {
  constructor(demandId: string, actorId: string, public readonly commentary: string) {
    super(demandId, actorId);
  }
}

export const DEMAND_EVENTS = {
  SUBMITTED:    'demand.submitted',
  APPROVED:     'demand.approved',
  REJECTED:     'demand.rejected',
  REROUTED:     'demand.rerouted',
  PROMOTED:     'demand.promoted',
  CANCELLED:    'demand.cancelled',
  TYPE_CHANGED: 'demand.typeChanged',
  ACCEPTED:              'demand.accepted',
  DM_REJECTED:           'demand.dmRejected',
  DM_REROUTED:           'demand.dmRerouted',
  PM_APPROVED:           'demand.pmApproved',
  PM_REJECTED:           'demand.pmRejected',
  RETURNED:              'demand.returned',
  BC_REVIEW_STARTED:     'demand.bcReviewStarted',
  BC_APPROVED:           'demand.bcApproved',
  BC_REJECTED:           'demand.bcRejected',
  BC_REROUTED_TO_REQUESTER: 'demand.bcReroutedToRequester',
  PM_SENT_TO_REQUESTER:     'demand.pmSentToRequester',
  PM_SENT_TO_DM:            'demand.pmSentToDm',
  DEMAND_TYPE_SWITCHED:     'demand.typeSwitched',
  // Story 4.5 — SP notification events
  SP_DM_ACCEPTED:     'demand.spDmAccepted',
  SP_OFFER_SENT:      'demand.spOfferSent',
  SP_OFFER_ACCEPTED:  'demand.spOfferAccepted',
  SP_OFFER_REWORKED:  'demand.spOfferReworked',
} as const;

export type DemandEventName = typeof DEMAND_EVENTS[keyof typeof DEMAND_EVENTS];
