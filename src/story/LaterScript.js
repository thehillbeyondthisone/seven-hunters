const answer = (text, next, flag) => ({text, next, minutes:2, ...(flag ? {flag} : {})});
export const PHOTO_SIGNAL = {start:'hello',nodes:{
	hello:{her:'LIGHT SEEN. HOW DO YOU PASS THE DAY',options:[answer('MARY SENT A CAMERA. SIX PICTURES.','pictures'),answer('TEA. MACHINERY. THE SAME FEW ROOMS.','rooms')]},
	pictures:{her:'WHAT WILL YOU TAKE HOME',options:[answer('THE CHAIR WHERE I SIT. THE LIGHT. THE LANDING.','rooms')]},
	rooms:{her:'I PUT A SECOND CUP OUT THIS MORNING.',options:[answer('I WOULD HAVE STAYED FOR TEA.','warm','warm'),answer('IT HELPS TO HAVE SOMEONE WATCHING.','warm','guarded')]},
	warm:{her:'THEN COME BACK TO THE LAMP TOMORROW.',options:[answer('IF THE WEATHER LETS US. GOOD NIGHT CATE.','end')]},
	end:{her:'GOOD NIGHT WALTER.',end:true},
}};
// Legacy review only. Scene thirteen’s replacement dialogue is not approved.
export function confessionScript(fragmentSeen){return {start:'away',nodes:{
	away:{her:'I WAS AWAY ON FRIDAY. MY MOTHER WAS UNWELL.',options:[answer(fragmentSeen?'I SAW A FEW FLASHES. NO WHOLE MESSAGE.':'THE FOG CLOSED IN. I COULD NOT SEE YOU.','source')]},
	source:{her:fragmentSeen?'THOSE FLASHES WERE NOT MINE.':'I COULD NOT WATCH FROM HERE.',options:[answer(fragmentSeen?'I COULD NOT FIND THEIR SOURCE.':'THERE WERE DAYS WITHOUT CONTACT.','admit')]},
	admit:{her:'THERE IS SOMETHING I MUST TELL YOU.',options:[answer('I AM LISTENING.','december')]},
	december:{her:'IN DECEMBER I SAID THEIR LIGHT WAS ALL RIGHT.',options:[answer('COULD YOU SEE IT','weather')]},
	weather:{her:'NO. WEATHER HID IT. I REPORTED REASSURANCE.',options:[answer('YOU SHOULD HAVE SAID YOU COULD NOT SEE.','angry','angry'),answer('YOU WERE AFRAID. I UNDERSTAND THAT.','kind','kind'),answer('I DO NOT KNOW WHAT TO SAY.','guarded','guarded')]},
	angry:{her:'YES. I SHOULD HAVE SAID THAT.',options:[answer('CAN YOU KNOW WHAT DIFFERENCE IT WOULD HAVE MADE','unknown')]},
	kind:{her:'FEAR DOES NOT MAKE MY REPORT TRUE.',options:[answer('CAN YOU KNOW WHAT DIFFERENCE IT WOULD HAVE MADE','unknown')]},
	guarded:{her:'YOU NEED NOT MAKE IT EASIER FOR ME.',options:[answer('CAN YOU KNOW WHAT DIFFERENCE IT WOULD HAVE MADE','unknown')]},
	unknown:{her:'NO. I CANNOT KNOW IF IT WOULD HAVE SAVED THEM.',options:[answer('WRITE WHAT YOU KNOW. I WILL DO THE SAME.','end')]},
	end:{her:'I WILL. GOOD NIGHT WALTER.',end:true},
}};}
export const PREPARE_SIGNAL = {start:'weather',nodes:{
	weather:{her:'RELIEF DELAYED. HEAVY WEATHER COMING.',options:[answer('UPPER BRAKE REPAIRED. OIL GOING UP.','landing')]},
	landing:{her:'KEEP CLEAR OF THE LOWER LANDINGS.',options:[answer('I WILL WATCH FROM THE UPPER TRAMWAY.','promise')]},
	promise:{her:'IF I LOSE YOU I WILL REPORT THAT.',options:[answer('THANK YOU CATE. KEEP WATCH.','end')]},
	end:{her:'I AM HERE.',end:true},
}};
// Original ending source retained on hold; entered only by explicit legacy review.
export function farewellScript(response){return {start:'relief',nodes:{
	relief:{her:'RELIEF IN SIGHT. ARE YOU GOING HOME',options:[answer('YES. STATION HANDED OVER. LIGHT IN ORDER.','home')]},
	home:{her:response==='angry'?'I WILL KEEP TO WHAT I CAN SEE.':'I AM GLAD YOU ARE GOING HOME.',options:[answer('THANK YOU FOR KEEPING WATCH WITH ME.','warm','warm'),answer('KEEP REPORTING WHAT YOU KNOW.','reserved','reserved')]},
	warm:{her:'WRITE WHEN YOU ARE ASHORE. IF YOU WISH.',options:[answer('I WILL. GOODBYE CATE.','end')]},
	reserved:{her:'I WILL. SAFE PASSAGE WALTER.',options:[answer('GOODBYE CATE.','end')]},
	end:{her:'GOODBYE WALTER.',end:true},
}};}
