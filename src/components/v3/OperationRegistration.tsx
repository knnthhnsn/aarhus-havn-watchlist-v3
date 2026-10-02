"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, type Locale, type OperationState, type PortCall, type PortOperation, type ServiceCode } from "@/lib/watchlist";
import type { MobileTaskOverride } from "@/lib/mobileTask";
import { operationLabel, operationPrimaryTime, operationStateLabel } from "@/components/watchlist/lifecycleData";
import surface from "./StateSurface.module.css";
import s from "./OperationRegistration.module.css";

const states = ["expected", "ordered", "actual"] as const;
const codes = ["H", "L", "B"] as const;

export function registrationTime(operation: PortOperation, call: PortCall): string {
  const times = operation.type === "arrival" ? call.arrivalTimes
    : operation.type === "departure" ? call.departureTimes : [];
  return operationPrimaryTime(operation, times);
}

export function registrationServices(operation: PortOperation): NonNullable<MobileTaskOverride["services"]> {
  return Object.fromEntries(operation.serviceCodes.map(code => [code, operation.serviceStates?.[code] ?? operation.state]));
}

/** Only assistance can choose STUD; retain any legacy value on other operation types. */
export function registrationWorkLocation(operation: PortOperation, selected: "quay" | "stud"): "quay" | "stud" | undefined {
  return operation.type === "assistance" ? selected : operation.workLocation;
}

function StateChoice({ label, value, onChange, locale }: { label: string; value: OperationState; onChange: (state: OperationState) => void; locale: Locale }) {
  const name = useId();
  return <fieldset className={s.states}><legend>{label}</legend><div>{states.map(state => <label key={state} className={`${s.choice} ${value === state ? surface.surface : ""}`} data-state={value === state ? state : undefined}>
    <input type="radio" name={name} value={state} checked={value === state} onChange={() => onChange(state)} />
    <span>{operationStateLabel(state, locale)}</span>
  </label>)}</div></fieldset>;
}

function RegistrationFields({ operation, call, locale, onSave, onCancel }: { operation: PortOperation; call: PortCall; locale: Locale; onSave: (operation: PortOperation, value: MobileTaskOverride) => void; onCancel: () => void }) {
  const da = locale === "da";
  const [state, setState] = useState(operation.state);
  const [services, setServices] = useState(() => registrationServices(operation));
  const [quantity, setQuantity] = useState(operation.tugQuantity ?? 1);
  const [workLocation, setWorkLocation] = useState(operation.workLocation ?? "quay");
  const canChooseStud = operation.type === "assistance";
  const names: Record<ServiceCode, string> = da ? { H: "Trosseføring", L: "Lods", B: "Bugserbåd" } : { H: "Linesmen", L: "Pilot", B: "Tugs" };
  function toggle(code: ServiceCode, enabled: boolean) {
    setServices(value => { const next = { ...value }; if (enabled) next[code] = "expected"; else delete next[code]; return next; });
  }
  return <form className={s.form} onSubmit={event => {
    event.preventDefault();
    const preservedLocation = registrationWorkLocation(operation, workLocation);
    onSave(operation, { state, services, ...(preservedLocation ? { workLocation: preservedLocation } : {}), ...(services.B ? { tugQuantity: quantity } : {}) });
  }}>
    <p className={s.time}>{operationLabel(operation, locale, call)} · {formatDateTime(registrationTime(operation, call), locale, "compact")}</p>
    <StateChoice label={da ? "Operationens status" : "Operation status"} value={state} onChange={setState} locale={locale} />
    {canChooseStud && <label className={s.operation}>{da ? "Arbejdssted" : "Work location"}<select value={workLocation} onChange={event => setWorkLocation(event.target.value as "quay" | "stud")}><option value="quay">{da ? "Ved kaj" : "At quay"}</option><option value="stud">{da ? "STUD · kørsel ud til skibet" : "STUD · travel to vessel"}</option></select></label>}
    <div className={s.heading}><strong>{da ? "Service til operationen" : "Services for this operation"}</strong><p>{da ? "Vælg det, der er behov for. Hver service har sin egen status." : "Select the services required. Each service has its own status."}</p></div>
    {codes.map(code => <section key={code} className={`${s.service} ${services[code] ? surface.surface : ""}`} data-state={services[code]}>
      <label className={s.toggle}><input type="checkbox" checked={!!services[code]} onChange={event => toggle(code, event.target.checked)} /><strong>{names[code]}</strong><span>{services[code] ? (da ? "Tilvalgt" : "Included") : (da ? "Ikke tilvalgt" : "Not included")}</span></label>
      {services[code] && <><StateChoice label={`${names[code]} · status`} value={services[code]} onChange={value => setServices(current => ({ ...current, [code]: value }))} locale={locale} />
        {code === "B" && <label className={s.quantity}>{da ? "Antal bugserbåde" : "Number of tugs"}<select value={quantity} onChange={event => setQuantity(Number(event.target.value))}>{[1,2,3,4,5,6,7,8,9].map(n => <option key={n}>{n}</option>)}</select></label>}</>}
    </section>)}
    <div className={s.actions}><button type="button" onClick={onCancel}>{da ? "Annullér" : "Cancel"}</button><button type="submit" className={s.save}>{da ? "Gem registrering" : "Save registration"}</button></div>
  </form>;
}

export function OperationRegistration({ call, operations, initialOperation, locale, onSave, onCancel }: { call: PortCall; operations: readonly PortOperation[]; initialOperation: PortOperation; locale: Locale; onSave: (operation: PortOperation, value: MobileTaskOverride) => void; onCancel: () => void }) {
  const [selectedId, setSelectedId] = useState(initialOperation.id);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const operation = operations.find(item => item.id === selectedId);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <section className={s.editor} aria-labelledby={id}>
    <h3 ref={heading} tabIndex={-1} id={id}>{locale === "da" ? "Registrér operation" : "Register operation"}</h3>
    <label className={s.operation}>{locale === "da" ? "Vælg operation" : "Select operation"}<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{operations.map(item => <option value={item.id} key={item.id}>{operationLabel(item, locale, call)} · {formatDateTime(registrationTime(item, call), locale, "compact")}</option>)}</select></label>
    {operation ? <RegistrationFields key={`${operation.id}:${JSON.stringify(operation)}`} operation={operation} call={call} locale={locale} onSave={onSave} onCancel={onCancel} /> : <><p role="alert">{locale === "da" ? "Operationen er ændret. Vælg en operation igen." : "Operation changed. Select an operation again."}</p><button onClick={onCancel}>{locale === "da" ? "Luk" : "Close"}</button></>}
  </section>;
}
