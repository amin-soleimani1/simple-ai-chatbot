export const DEFAULT_MARKET_REFERENCE_CATALOG = {
	schemaVersion: 1,
	categories: [
		["economy-bulbs", "لامپ LED اقتصادی", "wattage"], ["led-bulbs", "لامپ LED", "wattage"], ["filament-bulbs", "لامپ فیلامنتی", "wattage"], ["candle-bulbs", "لامپ اشکی", "wattage"], ["halogen-bulbs", "لامپ هالوژن", "wattage"],
		["led-tube-lights", "لامپ مهتابی LED", "wattage"], ["led-strips", "ریسه LED", "wattage"], ["led-modules", "ماژول LED", "wattage"], ["led-chips", "چیپ LED", "wattage"], ["led-drivers", "درایور LED", "wattage"],
		["led-power-supplies", "منبع تغذیه LED", "wattage"], ["ceiling-panels", "پنل سقفی LED", "wattage"], ["downlights", "چراغ دان‌لایت", "wattage"], ["spotlights", "چراغ اسپات", "wattage"], ["projectors", "پروژکتور LED", "wattage"],
		["street-lights", "چراغ خیابانی", "wattage"], ["wall-lights", "چراغ دیواری", "model"], ["ceiling-lights", "چراغ سقفی", "model"], ["emergency-lights", "چراغ اضطراری", "model"], ["sensor-lights", "چراغ سنسوردار", "model"],
		["cabinet-lights", "چراغ کابینتی", "size"], ["linear-lights", "چراغ خطی", "size"], ["track-lights", "چراغ ریلی", "model"], ["garden-lights", "چراغ باغی", "model"], ["led-controllers", "کنترلر LED", "model"],
		["led-strip-accessories", "لوازم ریسه LED", "model"], ["wall-switches", "کلید دیواری", "model"], ["wall-sockets", "پریز دیواری", "model"], ["dimmers", "دیمر", "model"], ["smart-switches", "کلید هوشمند", "model"],
		["industrial-plugs", "دوشاخه صنعتی", "ampere"], ["industrial-sockets", "پریز صنعتی", "ampere"], ["miniature-circuit-breakers", "کلید مینیاتوری", "breaker_model"], ["residual-current-devices", "محافظ جان", "ampere"], ["molded-case-circuit-breakers", "کلید اتوماتیک", "breaker_model"],
		["fuse-holders", "فیوز و پایه فیوز", "ampere"], ["distribution-boxes", "جعبه فیوز", "size"], ["distribution-panels", "تابلو برق", "size"], ["contactors", "کنتاکتور", "ampere"], ["electrical-relays", "رله برق", "ampere"],
		["time-switches", "تایمر برق", "model"], ["voltage-protectors", "محافظ ولتاژ", "ampere"], ["building-wire", "سیم ساختمان", "cable_size"], ["flexible-cable", "کابل افشان", "cable_size"], ["power-cable", "کابل برق", "cable_size"],
		["coaxial-cable", "کابل کواکسیال", "cable_size"], ["conduit", "لوله برق", "size"], ["flexible-conduit", "لوله خرطومی", "size"], ["trunking", "داکت برق", "size"], ["junction-boxes", "جعبه تقسیم", "size"],
	].map(([id, title, variantSchema], index) => ({ id, title, variantSchema, enabled: true, sortOrder: (index + 1) * 10 })),
};
