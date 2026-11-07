import { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  MapPin,
  Sparkles,
  X,
  ChevronDown,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const TIME_SLOTS = [
  { id: "morning", label: "Morning", time: "9 AM–12 PM" },
  { id: "afternoon", label: "Afternoon", time: "12 PM–3 PM" },
  { id: "late_afternoon", label: "Late Afternoon", time: "3 PM–6 PM" },
  { id: "evening", label: "Evening", time: "6 PM–9 PM" },
  { id: "flexible", label: "Flexible", time: "Any time" },
] as const;

export const QUICK_PRESETS = [
  { label: "Today", template: "Today · Afternoon or Evening" },
  { label: "Tomorrow", template: "Tomorrow · Afternoon (12 PM–3 PM)" },
  { label: "Weekdays after 4 PM", template: "Weekdays after 4 PM" },
  { label: "Weekends", template: "Weekends · Flexible" },
  { label: "Flexible", template: "Flexible / Any time" },
] as const;

export const CAMPUS_SPOTS = [
  "Main Hall",
  "Central Library",
  "Student Center",
  "Campus Cafe",
] as const;

export interface AvailabilityPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const monthShort = date.toLocaleString("en-US", { month: "short" });
  const dayNum = date.getDate();

  if (diffDays === 0) return `Today (${monthShort} ${dayNum})`;
  if (diffDays === 1) return `Tomorrow (${monthShort} ${dayNum})`;

  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  return `${weekday}, ${monthShort} ${dayNum}`;
}

export function AvailabilityPicker({
  value,
  onChange,
  id,
  placeholder = "Select meetup date, time slot & location…",
  className,
  disabled = false,
}: AvailabilityPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string>("afternoon");
  const [locationNote, setLocationNote] = useState<string>("");
  const [customText, setCustomText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"structured" | "custom">("structured");

  // Synchronize internal state with external value when popover opens
  useEffect(() => {
    if (!open) return;
    if (value && value.trim()) {
      setCustomText(value.trim());
      // Try to extract existing campus spot if present
      for (const spot of CAMPUS_SPOTS) {
        if (value.includes(spot)) {
          setLocationNote(spot);
          break;
        }
      }
    }
  }, [open, value]);

  function applyStructured(date?: Date, slotId?: string, spot?: string) {
    const d = date || selectedDate || new Date();
    const sId = slotId !== undefined ? slotId : selectedSlot;
    const loc = (spot !== undefined ? spot : locationNote).trim();

    const slotObj = TIME_SLOTS.find((s) => s.id === sId) || TIME_SLOTS[1];
    const dateStr = formatDateLabel(d);
    const slotStr =
      slotObj.id === "flexible" ? "Flexible / Any time" : `${slotObj.label} (${slotObj.time})`;

    let combined = `${dateStr} · ${slotStr}`;
    if (loc) {
      combined += ` · ${loc}`;
    }

    // Strict 190-character safety bound (well within Firestore 200 char rule)
    if (combined.length > 190) {
      combined = combined.slice(0, 190).trim();
    }

    onChange(combined);
  }

  function handlePresetClick(presetTemplate: string) {
    let result = presetTemplate;
    if (locationNote.trim() && !result.includes(locationNote.trim())) {
      result += ` · ${locationNote.trim()}`;
    }
    if (result.length > 190) {
      result = result.slice(0, 190).trim();
    }
    onChange(result);
    setOpen(false);
  }

  function handleCustomSave() {
    let text = customText.trim();
    if (!text) {
      onChange("Flexible");
    } else {
      if (text.length > 190) {
        text = text.slice(0, 190).trim();
      }
      onChange(text);
    }
    setOpen(false);
  }

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Input Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-left text-sm transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40",
              !value && "text-muted-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5 truncate">
              <Clock className="size-4 shrink-0 text-primary" />
              <span className="truncate font-medium">{value || placeholder}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {value ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onChange("");
                    }
                  }}
                  className="rounded-full p-1 hover:bg-muted hover:text-foreground"
                  title="Clear availability"
                  aria-label="Clear availability"
                >
                  <X className="size-3.5" />
                </span>
              ) : null}
              <ChevronDown className="size-3.5 opacity-60" />
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[calc(100vw-2rem)] sm:w-[380px] rounded-2xl border-border bg-card p-4 shadow-xl"
        >
          {/* Header & Mode Tabs */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-1.5 font-heading text-sm font-bold">
              <CalendarIcon className="size-4 text-primary" />
              <span>Select Availability</span>
            </div>
            <div className="flex rounded-lg bg-muted p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("structured")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  activeTab === "structured"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Date & Time
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custom")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  activeTab === "custom"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Custom Note
              </button>
            </div>
          </div>

          {activeTab === "structured" ? (
            <div className="mt-3 space-y-4">
              {/* Quick Presets */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Quick Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handlePresetClick(p.template)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                    >
                      <Sparkles className="size-2.5 text-primary" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Calendar Picker */}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pick a Date
                </p>
                <div className="flex justify-center rounded-xl border border-border bg-muted/20 p-1">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      if (date) {
                        applyStructured(date, selectedSlot, locationNote);
                      }
                    }}
                    disabled={isPastDate}
                    className="p-1"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Select Time Slot
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = selectedSlot === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot.id);
                          applyStructured(selectedDate, slot.id, locationNote);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-xl border px-2.5 py-1.5 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-muted/60",
                        )}
                      >
                        <span className="text-xs font-bold flex items-center justify-between w-full">
                          {slot.label}
                          {isSelected && <Check className="size-3 text-primary" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{slot.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campus Meetup Spot (Optional) */}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Campus Meetup Spot (Optional)
                </p>
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {CAMPUS_SPOTS.map((spot) => (
                    <button
                      key={spot}
                      type="button"
                      onClick={() => {
                        const newSpot = locationNote === spot ? "" : spot;
                        setLocationNote(newSpot);
                        applyStructured(selectedDate, selectedSlot, newSpot);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                        locationNote === spot
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <MapPin className="size-2.5" />
                      {spot}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={locationNote}
                  maxLength={60}
                  placeholder="e.g. 2nd floor library, cafe entrance"
                  onChange={(e) => {
                    const note = e.target.value;
                    setLocationNote(note);
                    applyStructured(selectedDate, selectedSlot, note);
                  }}
                  className="w-full rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Done button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
              >
                Apply Availability
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Need a custom pickup schedule? Enter your timing and preferred campus location
                below:
              </p>
              <textarea
                rows={3}
                value={customText}
                maxLength={190}
                placeholder="e.g. Mon/Wed after 3 PM or Friday mornings at Student Center"
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/40 p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Maximum 190 characters</span>
                <span className={customText.length > 180 ? "font-bold text-amber" : ""}>
                  {customText.length} / 190
                </span>
              </div>
              <button
                type="button"
                onClick={handleCustomSave}
                className="w-full rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
              >
                Save Custom Availability
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* One-tap quick chips right on the form for effortless selection */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Quick suggestions:
        </span>
        {QUICK_PRESETS.slice(0, 4).map((p) => {
          const isSelected = value.includes(p.label);
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.template)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
