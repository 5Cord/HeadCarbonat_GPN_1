// Те же зоны, которые карта региона показывает с 9-го года.
export const PIPELINE_ZONE_CELLS = {
  0:    ['D6','D7','E6','E7'],
  500:  ['C5','C6','C7','C8','D8','E8','F8','F7','F6','F5','E5','D5'],
  1000: ['B4','B5','B6','B7','B8','B9','C9','D9','E9','F9','G9','G8','G7','G6','G5','G4','F4','E4','D4','C4'],
  1500: ['A3','A4','A5','A6','A7','A8','A9','A10','B3','C3','D3','E3','F3','G3','H3','H4','H5','H6','H7','H8','H9','H10','B10','C10','D10','E10','F10','G10'],
  2000: ['A2','B2','C2','D2','E2','F2','G2','H2','I2','I3','I4','I5','I6','I7','I8','I9','I10'],
  2500: ['A1','B1','C1','D1','E1','F1','G1','H1','I1','J1','J2','J3','J4','J5','J6','J7','J8','J9','J10'],
};

export const getPipelineCost = (cellRef) => {
  const zone = Object.entries(PIPELINE_ZONE_CELLS).find(([, cells]) => cells.includes(cellRef));
  return zone ? Number(zone[0]) : null;
};
