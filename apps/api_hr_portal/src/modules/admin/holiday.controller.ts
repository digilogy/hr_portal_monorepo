import { Request, Response } from "express";
import { holidayRepository } from "./holiday.repository";
import { logger } from "@hr-portal/logger";

export class HolidayController {
  static async getAllHolidays(req: Request, res: Response): Promise<void> {
    try {
      const holidays = await holidayRepository.findAll();
      res.status(200).json(holidays);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("HolidayController", "Failed to fetch holidays", { error: message });
      res.status(500).json({ message });
    }
  }

  static async createHoliday(req: Request, res: Response): Promise<void> {
    try {
      const { name, startDate, endDate, zones, isOptional } = req.body;
      if (!name || !startDate || !endDate || !zones || !Array.isArray(zones)) {
        res.status(400).json({ message: "Invalid holiday data provided" });
        return;
      }

      const sDate = new Date(startDate);
      const eDate = new Date(endDate);

      // Check for overlaps
      const existingHolidays = await holidayRepository.findAll();
      const hasOverlap = existingHolidays.some(h => {
        const hStart = new Date(h.startDate);
        const hEnd = new Date(h.endDate);
        const datesOverlap = sDate <= hEnd && eDate >= hStart;
        const zonesIntersect = h.zones.some(z => zones.includes(z));
        return datesOverlap && zonesIntersect;
      });

      if (hasOverlap) {
        res.status(400).json({ message: "A holiday with overlapping dates already exists in one or more selected zones." });
        return;
      }

      const holiday = await holidayRepository.create({
        name,
        startDate: sDate,
        endDate: eDate,
        zones,
        isOptional: !!isOptional,
      });

      res.status(201).json(holiday);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("HolidayController", "Failed to create holiday", { error: message });
      res.status(500).json({ message });
    }
  }

  static async updateHoliday(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, startDate, endDate, zones, isOptional } = req.body;
      
      const holiday = await holidayRepository.findById(Number(id));
      if (!holiday) {
        res.status(404).json({ message: "Holiday not found" });
        return;
      }

      const updatedStartDate = startDate ? new Date(startDate) : new Date(holiday.startDate);
      const updatedEndDate = endDate ? new Date(endDate) : new Date(holiday.endDate);
      const updatedZones = zones || holiday.zones;

      // Check for overlaps (excluding the current holiday)
      const existingHolidays = await holidayRepository.findAll();
      const hasOverlap = existingHolidays.some(h => {
        if (h.id === Number(id)) return false;
        const hStart = new Date(h.startDate);
        const hEnd = new Date(h.endDate);
        const datesOverlap = updatedStartDate <= hEnd && updatedEndDate >= hStart;
        const zonesIntersect = h.zones.some(z => updatedZones.includes(z));
        return datesOverlap && zonesIntersect;
      });

      if (hasOverlap) {
        res.status(400).json({ message: "A holiday with overlapping dates already exists in one or more selected zones." });
        return;
      }

      const updated = await holidayRepository.update(Number(id), {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        zones,
        isOptional,
      });

      res.status(200).json(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("HolidayController", "Failed to update holiday", { error: message });
      res.status(500).json({ message });
    }
  }

  static async deleteHoliday(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await holidayRepository.delete(Number(id));
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("HolidayController", "Failed to delete holiday", { error: message });
      res.status(500).json({ message });
    }
  }
}
