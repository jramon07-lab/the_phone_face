const ZONE = "Europe/Madrid";

type MadridParts = { year:number; month:number; day:number; hour:number; minute:number };

function madridParts(date:Date):MadridParts {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone:ZONE, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  });
  const parts = Object.fromEntries(format.formatToParts(date)
    .filter(part=>part.type!=="literal").map(part=>[part.type,Number(part.value)]));
  return parts as MadridParts;
}

function localDate(year:number,month:number,day:number,minuteOfDay:number):Date {
  const hour=Math.floor(minuteOfDay/60),minute=minuteOfDay%60;
  const guess=new Date(Date.UTC(year,month-1,day,hour,minute));
  const shown=madridParts(guess);
  const shownAsUtc=Date.UTC(shown.year,shown.month-1,shown.day,shown.hour,shown.minute);
  return new Date(guess.getTime()-(shownAsUtc-guess.getTime()));
}

function addLocalDays(parts:MadridParts,days:number):MadridParts {
  const date=new Date(Date.UTC(parts.year,parts.month-1,parts.day+days));
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:parts.hour,minute:parts.minute};
}

function daysInMonth(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate();}

function addLocalMonths(parts:MadridParts,months:number):MadridParts {
  const total=parts.year*12+(parts.month-1)+months;
  const year=Math.floor(total/12),month=((total%12)+12)%12+1;
  return {...parts,year,month,day:Math.min(parts.day,daysInMonth(year,month))};
}

function isSunday(parts:MadridParts){return new Date(Date.UTC(parts.year,parts.month-1,parts.day)).getUTCDay()===0;}

export function madridDateAfter(origin:Date,value=1,unit="days"):string {
  const amount=Math.max(0,Math.floor(Number(value)||0)),parts=madridParts(origin);
  const target=unit==="years"?addLocalMonths(parts,amount*12):unit==="months"?addLocalMonths(parts,amount):addLocalDays(parts,amount);
  return `${target.year}-${String(target.month).padStart(2,"0")}-${String(target.day).padStart(2,"0")}`;
}

export function nextBusinessSendAt(origin:Date,value=1,unit="days"):Date {
  const amount=Math.max(0,Math.floor(Number(value)||0)),parts=madridParts(origin);
  let target=unit==="months"?addLocalMonths(parts,amount):unit==="years"?addLocalMonths(parts,amount*12):addLocalDays(parts,amount);
  let minute=target.hour*60+target.minute;
  let searchFrom=localDate(target.year,target.month,target.day,minute);
  for(let guard=0;guard<8;guard++){
    target=madridParts(searchFrom);
    if(isSunday(target)){
      const monday=addLocalDays(target,1);
      const mondayMinute=minute<600?600:minute<=840?minute:minute<1050?1050:minute<=1230?minute:600;
      return localDate(monday.year,monday.month,monday.day,mondayMinute);
    }
    if(minute<600)return localDate(target.year,target.month,target.day,600);
    if(minute<=840)return localDate(target.year,target.month,target.day,minute);
    if(minute<1050)return localDate(target.year,target.month,target.day,1050);
    if(minute<=1230)return localDate(target.year,target.month,target.day,minute);
    const tomorrow=addLocalDays(target,1);
    minute=600;
    searchFrom=localDate(tomorrow.year,tomorrow.month,tomorrow.day,minute);
  }
  throw new Error("No se pudo calcular la siguiente franja de envío");
}
