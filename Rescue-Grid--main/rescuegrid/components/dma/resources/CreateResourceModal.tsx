"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";

interface CreateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateResourceModal({ isOpen, onClose, onCreated }: CreateResourceModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [threshold, setThreshold] = useState("");
  const [ownerInfo, setOwnerInfo] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim()) {
      setError("Name and type are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/dma/resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: type.trim(),
          quantity: parseFloat(quantity) || 0,
          unit: unit.trim() || null,
          low_stock_threshold: parseFloat(threshold) || 0,
          owner_info: ownerInfo.trim() || null,
          location: location.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }

      onCreated();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create resource");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setType("");
    setQuantity("");
    setUnit("");
    setThreshold("");
    setOwnerInfo("");
    setLocation("");
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-2 w-full max-w-md clip-path-tactical">
        <div className="border-b-2 border-orange px-4 py-3">
          <div className="flex justify-between items-center">
            <h2 className="font-display font-semibold text-lg text-orange uppercase tracking-wider">
              ADD RESOURCE
            </h2>
            <button onClick={onClose} className="text-muted hover:text-ink text-xl">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <InputField
            label="Resource Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Food Packets"
            required
          />

          <InputField
            label="Type *"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="food, medical, equipment"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min="0"
            />
            <InputField
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="units, kg, liters"
            />
          </div>

          <InputField
            label="Low Stock Threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="Alert when below this"
            min="0"
          />

          <InputField
            label="Owner"
            value={ownerInfo}
            onChange={(e) => setOwnerInfo(e.target.value)}
            placeholder="District Supply Office"
          />

          <InputField
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Dhanbad Warehouse"
          />

          {error && (
            <p className="text-alert font-mono text-xs">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              CANCEL
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "CREATING..." : "ADD RESOURCE"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
