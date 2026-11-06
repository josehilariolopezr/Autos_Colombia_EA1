import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TicketIngresoComponent } from './ticket-ingreso';

describe('TicketIngresoComponent', () => {
  let component: TicketIngresoComponent;
  let fixture: ComponentFixture<TicketIngresoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TicketIngresoComponent ]
    }).compileComponents();

    fixture = TestBed.createComponent(TicketIngresoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});