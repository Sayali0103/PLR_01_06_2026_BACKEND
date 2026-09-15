import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Job from './models/Job.js'

dotenv.config()

const jobs = [
  {
    title: 'Human Resources',
    dept: 'Talent Acquisition Team',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Join P.L. Robotics, an emerging robotics technology company building advanced industrial automation solutions for Indian manufacturing. You will work with the Talent Acquisition Team to support recruitment, HR operations, employee engagement, and people initiatives while collaborating with engineers and cross-functional teams building the future of robotics. This is an opportunity to gain practical experience in a fast-growing technology and manufacturing environment while helping create a strong, positive workplace culture.',
    responsibilities: [
      'Assist in sourcing candidates through LinkedIn, job portals, and other recruitment platforms.',
      'Post and manage job openings across relevant recruitment channels.',
      'Screen resumes and applications based on job requirements.',
      'Coordinate and schedule candidate interviews with hiring managers.',
      'Communicate with candidates regarding interview schedules, requirements, and follow-ups.',
      'Maintain and update candidate databases, recruitment trackers, and hiring records.',
      'Assist with employee onboarding and joining formalities.',
      'Maintain and organize employee records and HR documentation.',
      'Support day-to-day HR operations and administrative activities.',
      'Assist in preparing HR reports, trackers, and other HR-related documentation.',
      'Support employee engagement activities, team events, celebrations, and workplace initiatives.',
      'Assist in coordinating employee training and development programs.',
      'Collect and maintain training and employee feedback records.',
      'Support internal HR communications and announcements.',
      'Assist in implementing HR policies, processes, and initiatives.',
      'Coordinate with different departments to understand and support their recruitment and people-related requirements.',
      'Contribute ideas and initiatives to improve employee experience and workplace culture.',
      'Support the HR team in building a positive, collaborative, and engaging work environment.',
    ],
    requiredSkills: [
      'Strong interest in Human Resources, recruitment, and people management.',
      'Good written and verbal communication skills.',
      'Strong interpersonal and relationship-building skills.',
      'Good organizational and time-management skills.',
      'Ability to manage multiple tasks and coordinate effectively.',
      'Basic understanding of recruitment and selection processes.',
      'Proficiency in Microsoft Office, particularly Excel, Word, and PowerPoint.',
      'Strong attention to detail and ability to maintain accurate records.',
      'Professional communication skills for interacting with candidates and employees.',
      'Familiarity with LinkedIn, job portals, and candidate sourcing is an advantage.',
      'Basic knowledge of HRMS, ATS, or other HR tools is a plus.',
      'Proactive, positive, and learning-oriented approach.',
      'Ability to work effectively in a fast-paced, on-site work environment.',
    ],
    educationRequirements: [
      'Bachelor degree or currently pursuing a degree in Human Resources, Business Administration, Management, Psychology, or a related field.',
      'Fresh graduates and candidates with 0-1 year of experience are welcome to apply.',
      'Candidates must be comfortable working on-site at Bhosari, Pune.',
    ],
    additionalSkills: [
      'Previous internship, academic, or project experience in Human Resources or recruitment is an advantage.',
      'Interest in recruitment, HR operations, employee engagement, and talent management.',
      'Working knowledge of Microsoft Office or Google Workspace.',
      'Exposure to LinkedIn, job portals, Canva, HRMS, or ATS platforms is an advantage.',
      'Ability to work independently and collaborate effectively with HR and cross-functional teams.',
      'Exposure to a startup, technology, manufacturing, or engineering environment is an advantage.',
    ],
    whyJoin: [
      'Based on your performance during the internship, you may be considered for full-time employment with P.L. Robotics Pvt. Ltd.',
      'Work with a collaborative team and contribute to building strong people practices at an emerging robotics company.',
    ],
    tags: ['Recruitment', 'HR Operations', 'Employee Engagement', 'Talent Acquisition', 'People Management'],
    applyInternUrl: 'https://plrobotics.in/careers',
    applyJobUrl: 'https://plrobotics.in/careers',
    isPaid: true,
    isActive: true,
  },
  {
    title: 'Electronics Engineer',
    dept: 'Research & Development',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Work on embedded firmware development, sensor and actuator integration, communication between embedded boards and higher-level compute platforms, and real-time control for robotics applications. You will take ownership of defined sub-projects, contribute ideas, refine and validate designs through testing on real hardware, and prepare clear, production-ready technical documentation.',
    responsibilities: [
      'Develop, test, and optimize embedded firmware for robotics and automation systems using STM32 and similar microcontrollers.',
      'Design and implement low-level drivers and real-time control logic for motors, sensors, and peripheral devices.',
      'Develop embedded applications on NVIDIA Jetson and Intel NUC platforms for robotics, perception, and system orchestration.',
      'Integrate microcontrollers with high-level compute platforms (Jetson/NUC) via UART, CAN, SPI, Ethernet.',
      'Implement and debug motor control systems (servo, stepper, BLDC) with precise timing and safety constraints.',
      'Perform system-level testing, debugging, and performance optimization across hardware and software layers.',
      'Prepare and maintain detailed technical documentation, including firmware architecture, communication protocols, wiring diagrams, and system workflows.',
      'Collaborate closely with mechanical, electronics, and robotics teams throughout the full product lifecycle.',
    ],
    requiredSkills: [
      'Strong fundamentals in Embedded Systems and Electronics (Digital & Analog circuits, microcontrollers, sensors, actuators).',
      'Proficiency in embedded C/C++ for STM32 or similar MCUs.',
      'Experience developing on NVIDIA Jetson (JetPack, Linux, device interfaces) and/or Intel NUC platforms.',
      'Solid understanding of real-time systems, interrupts, timers, and memory management.',
      'Hands-on experience with communication protocols: CAN, UART, I2C, SPI, Modbus, Ethernet.',
      'Ability to independently research, prototype, and debug embedded solutions.',
      'Strong documentation and technical writing skills.',
      'Self-driven, proactive, and passionate about building real-world robotic systems.',
    ],
    additionalSkills: [
      'Experience with robotics automation and motion control systems.',
      'Knowledge of motor control algorithms (PID, closed-loop control).',
      'Familiarity with Linux-based embedded systems.',
      'Experience integrating embedded systems with vision, AI, or perception pipelines.',
      'Basic understanding of hardware design, schematics, and PCB concepts.',
    ],
    whyJoin: [
      'Work on critical electronics for high-accuracy robotics.',
      'Be part of a full product lifecycle from research to prototyping.',
      'Opportunity to see your code and hardware designs control a working robot.',
    ],
    tags: ['Embedded C/C++', 'STM32', 'NVIDIA Jetson', 'CAN Bus', 'RTOS'],
    applyInternUrl: 'https://forms.gle/ojdBEngdeVVvFXun6',
    applyJobUrl: 'https://forms.gle/ojdBEngdeVVvFXun6',
    isPaid: true,
    isActive: true,
  },
  {
    title: 'UI Developer',
    dept: 'Research & Development',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Design and develop intuitive user interfaces for robotics dashboards, control panels, and internal tools. Work closely with the robotics and software teams to translate complex technical workflows into clean, user-friendly digital experiences. You will own UI modules, propose design improvements, and actively contribute to the product experience from concept to deployment.',
    responsibilities: [
      'Design and develop intuitive, user-friendly interfaces for robotics dashboards, control panels, and internal tools.',
      'Convert Figma/Adobe XD designs into fully functional, responsive web applications.',
      'Build and maintain reusable UI components using modern frameworks (React/Angular/Vue).',
      'Design structured layouts, technical visuals, and diagrams for user manuals and internal documentation.',
      'Ensure responsive design, cross-browser compatibility, and performance optimization across devices.',
      'Integrate front-end interfaces with WebSocket APIs and backend services.',
      'Develop and refine UI for real-time robot monitoring, data visualization, and control systems.',
      'Assist in implementing basic scripting or UI logic using Python where required.',
      'Support UI integration within Linux-based and ROS/ROS 2-based robotics environments.',
      'Conduct usability testing and continuously improve design consistency and user experience.',
      'Maintain clear, well-structured documentation for UI components, workflows, and development processes.',
    ],
    requiredSkills: [
      'Strong experience in UI/UX design and front-end development.',
      'Proficiency in HTML, CSS, and JavaScript.',
      'Hands-on experience with React / Angular / Vue.js (any one or more).',
      'Experience converting Figma / Adobe XD designs into fully functional applications.',
      'Solid understanding of responsive design and cross-browser compatibility.',
      'Ability to create technical visuals, diagrams, and structured layouts for manuals and documentation.',
      'Experience designing dashboards, control panels, and admin interfaces for technical or industrial applications.',
      'Familiarity with REST APIs and integration with backend services.',
      'Basic proficiency in Python for scripting, UI logic, or backend interaction.',
      'Basic knowledge of ROS / ROS 2 concepts, including nodes, topics, and robot workflows.',
      'Basic understanding of Linux-based development environments.',
      'Strong attention to detail, usability, and design consistency.',
    ],
    additionalSkills: [],
    whyJoin: [
      'Shape the UI/UX of next-generation robotics systems.',
      'Work alongside hardware and software engineers on real products.',
      'See your interfaces controlling live robots on the production floor.',
    ],
    tags: ['React', 'Figma', 'WebSockets', 'ROS 2', 'Python'],
    applyInternUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    applyJobUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    isPaid: true,
    isActive: true,
  },
  {
    title: 'Robotics Engineer',
    dept: 'Research & Development',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Work across robot design, controls, embedded systems, and motion planning. Key skills include ROS2, MOVEIT2, CAD modelling, and STM32 programming, with the ability to validate solutions on real robots from prototype to deployment.',
    responsibilities: [
      'Develop and maintain robotics software using Python and C++ in ROS 2 for core system architecture, node creation, and lifecycle management.',
      'Implement motion planning, trajectory generation, and inverse kinematics using MoveIt 2 for industrial robotic applications.',
      'Design and integrate Digital Twin environments using Gazebo and RViz for simulation, testing, and validation of industrial robots.',
      'Implement and manage ROS Control frameworks for controller management and hardware resource allocation.',
      'Develop and maintain HAL and hardware resource managers to interface with various robotic components and sensors.',
      'Work on CAN communication protocols for robust, real-time communication between robot controllers and peripherals.',
      'Build and deploy robotic applications, including ROS 2 lifecycle node creation for managing robot states and behaviours.',
      'Integrate APIs of ROS 2 and MoveIt 2 with the UI team into industrial applications.',
      'Collaborate with cross-functional teams (mechanical, electrical, and software engineers) to deliver robust and scalable robotic systems.',
      'Test, debug, and optimize robotic software on real hardware platforms.',
    ],
    requiredSkills: [
      'Experience with CAD tools (SolidWorks, Fusion 360, CATIA, or similar) for robotic and mechanical design.',
      'Knowledge of mechanical design, machine elements, motion transmission systems, and robotic actuators.',
      'Familiarity with ROS 2, including nodes, topics, services, and TF.',
      'Basic experience with MoveIt 2, RViz, and robot simulation tools such as Gazebo.',
      'Understanding of CAN/CANopen motor drives and industrial communication protocols (CAN, Modbus, EtherCAT, UART, SPI, I2C etc.).',
      'Programming skills in Python and C/C++ within a Linux environment.',
      'Experience with embedded systems and microcontrollers (STM32, ESP32, Arduino).',
      'Knowledge of motor control systems, including servo, stepper, and BLDC motors.',
      'Understanding of encoders, feedback systems, and closed-loop control.',
      'Experience with sensor integration, hardware debugging, and system troubleshooting.',
      'Familiarity with UART, SPI, I2C, and CAN communication interfaces and their applications in robotics.',
    ],
    additionalSkills: [],
    whyJoin: [
      'Build the software brain of next-generation Indian cobots.',
      'Work across simulation and real hardware, from Gazebo to factory floor.',
      'Be part of a full robotics stack from HAL to motion planning.',
    ],
    tags: ['ROS2', 'MOVEIT2', 'CAD modelling', 'STM32 programming', 'Gazebo'],
    applyInternUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    applyJobUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    isPaid: true,
    isActive: true,
  },
  {
    title: 'Mechanical Engineer',
    dept: 'Research & Development',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Work on CAD Design, Prototyping, DFA, DFM, and simulate precision gearbox systems for robotics applications. You will own sub-projects on our Harmonic Gear Drive and Cycloidal Gearbox systems, contribute ideas, refine designs, and prepare manufacturing-ready documentation.',
    responsibilities: [
      'Refine initial parameter estimations and structured design methodologies.',
      'Develop and optimise existing CAD models for gearbox systems.',
      'DFMA (Design for Manufacturing and Assembly) for precision robotics components.',
      'Perform FEA simulations for strength, fatigue life, and motion smoothness.',
      'Conduct independent literature surveys to improve designs and document findings.',
      'Prepare detailed manufacturing drawings with GD&T and tolerance specifications.',
      'Compile BOMs and assembly procedures.',
      'Maintain clear, well-structured documentation for every phase.',
    ],
    requiredSkills: [
      'Clear concepts in Mechanical Engineering (statics, dynamics, SOM, manufacturing processes).',
      'Proficiency in CAD software (SolidWorks, Fusion 360, or similar).',
      'Basic proficiency in FEA tools (any FEA-based tool, open source preferred).',
      'Ability to perform independent research and literature reviews quickly.',
      'Excellent documentation and technical writing skills.',
      'Self-driven, proactive, and genuinely excited about product development.',
    ],
    additionalSkills: [
      'Knowledge of gear design principles (Harmonic & Cycloidal systems).',
      'Experience with design for manufacturability in precision components.',
      'Understanding of robotics kinematics and motion control systems.',
      'FSAE, Baja, and Robocon students are preferred.',
    ],
    whyJoin: [
      'Work on critical precision components for high-accuracy robotics.',
      'Be part of a full product lifecycle from research to prototyping.',
      'Opportunity to see your designs move from CAD to a working robot.',
    ],
    tags: ['SolidWorks', 'FEA', 'GD&T', 'CAD', 'DFM', 'Prototyping'],
    applyInternUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    applyJobUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    isPaid: true,
    isActive: true,
  },
  {
    title: 'Technical Sales Engineer',
    dept: 'Sales & Business Development',
    location: 'Pune, India',
    positionType: 'Full time',
    overview:
      'Work at the intersection of industrial automation, robotics, and customer requirements. You will understand factory applications, explain PLR robotic solutions clearly, prepare technical proposals, coordinate demos, and help customers choose practical automation systems that fit their production needs.',
    responsibilities: [
      'Understand customer automation requirements through calls, visits, demos, and technical discussions.',
      'Explain PLR robotic products, applications, and integration possibilities to manufacturing customers.',
      'Prepare technical proposals, quotations, presentations, and solution notes with engineering inputs.',
      'Coordinate with robotics, mechanical, electronics, and software teams to validate feasibility and scope.',
      'Support product demos, proof-of-concept discussions, and follow-ups with prospective customers.',
      'Maintain CRM records, track leads, and support the sales cycle from enquiry to closure.',
    ],
    requiredSkills: [
      'Strong technical understanding of robotics, automation, mechanical systems, or industrial equipment.',
      'Ability to communicate technical concepts clearly to customers and internal engineering teams.',
      'Good presentation, documentation, negotiation, and follow-up skills.',
      'Basic understanding of manufacturing processes, factory layouts, cycle time, and automation ROI.',
      'Comfort with customer visits, demos, requirement gathering, and proposal preparation.',
      'Self-driven attitude with the ability to learn PLR products and convert customer problems into solution briefs.',
    ],
    educationRequirements: [
      'MBA, BMS, BBA, BE/B.Tech, or equivalent education in business, sales, marketing, mechanical, mechatronics, electronics, robotics, or a related field.',
    ],
    additionalSkills: [
      'Experience in B2B technical sales, industrial automation, robotics, machine tools, or manufacturing solutions.',
      'Familiarity with CAD drawings, robot applications, end effectors, PLCs, sensors, or vision systems.',
      'Knowledge of CRM tools, Excel/Sheets, proposal documents, and sales reporting.',
    ],
    whyJoin: [
      'Work closely with customers adopting next-generation Indian robotics.',
      'Bridge real factory problems with practical automation solutions.',
      'Collaborate directly with engineering teams on live product and deployment opportunities.',
    ],
    tags: ['Robotics Sales', 'Automation', 'Technical Proposals', 'Customer Demos', 'B2B Sales'],
    applyInternUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    applyJobUrl: 'https://forms.gle/s1XKDiRdrzaBeq347',
    isPaid: true,
    isActive: true,
  },
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    const internship = jobs.find(job => job.title === 'Human Resources')
    const existingInternship = await Job.findOne({
      title: { $in: ['Human Resources Intern', internship.title] },
    })
    const result = existingInternship
      ? await Job.updateOne({ _id: existingInternship._id }, { $set: internship })
      : await Job.updateOne({ title: internship.title }, { $set: internship }, { upsert: true })

    console.log(result.upsertedCount ? '✅ Added Human Resources posting' : '✅ Updated Human Resources posting')

    mongoose.disconnect()
    console.log('👋 Disconnected')
  } catch (err) {
    console.error('❌ Seed error:', err)
    process.exit(1)
  }
}

seed()
