import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subscription-faq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-faq.component.html',
  styleUrls: ['./subscription-faq.component.css']
})
export class SubscriptionFAQComponent {
  // Estado para controlar qué pregunta está abierta
  openIndex: number | null = null;

  faqs = [
    {
      question: '¿Cómo me inscribo a una membresía?',
      answer: 'Selecciona el plan que mejor se adapte a tu barbería en la sección superior, haz clic en el botón de suscripción, ingresa el nombre de tu barbería en el modal y confirma la solicitud.'
    },
    {
      question: '¿Cómo pago la membresía?',
      answer: 'Actualmente procesamos las solicitudes mediante nuestro sistema automatizado y te enviamos las pasarelas de pago y credenciales de acceso directamente a tu correo electrónico registrado.'
    },
    {
      question: '¿Tiene permanencia? ¿Puedo cancelar?',
      answer: 'No tenemos cláusulas de permanencia obligatoria. Puedes cancelar o cambiar de plan en cualquier momento desde la sección Suscripción y pagos de tu panel.'
    },
    {
      question: '¿Qué incluye exactamente cada plan?',
      answer: 'Cada plan detalla sus beneficios específicos en las tarjetas de precios, abarcando la gestión de citas, barberos, servicios, horarios y cola virtual. Las funciones marcadas como "Próximamente" aún no están disponibles.'
    },
    {
      question: '¿Dónde y en qué horario puedo usar mi membresía?',
      answer: 'La plataforma de gestión está disponible 24/7 en la nube, accesible desde cualquier dispositivo para ti y tu equipo de barberos.'
    }
  ];

  toggleFaq(index: number) {
    this.openIndex = this.openIndex === index ? null : index;
  }

}